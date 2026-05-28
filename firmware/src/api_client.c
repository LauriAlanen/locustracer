#include "api_client.h"
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_log.h"
#include "esp_websocket_client.h"
#include "cJSON.h"
#include "buzzer.h"
#include "shtc3.h"
#include "esp_mac.h"
#include "led_indicator.h"
#include "driver/temperature_sensor.h"

static const char *TAG = "API_CLIENT";

static bool g_is_master_node = false;

void api_client_set_node_type(bool is_master) {
    g_is_master_node = is_master;
}

#include "wifi_config.h"

#define WEBSOCKET_PORT 8009
#define API_TASK_DELAY_MS 5000 // 5 seconds for telemetry

static temperature_sensor_handle_t temp_sensor = NULL;

static void init_cpu_temp_sensor(void) {
    ESP_LOGI(TAG, "Install internal temperature sensor");
    // Range 20C to 100C is typical for internal CPU monitoring
    temperature_sensor_config_t temp_sensor_config = TEMPERATURE_SENSOR_CONFIG_DEFAULT(20, 100);
    esp_err_t err = temperature_sensor_install(&temp_sensor_config, &temp_sensor);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to install temperature sensor");
        return;
    }
    ESP_ERROR_CHECK(temperature_sensor_enable(temp_sensor));
}

float get_cpu_temp(void) {
    if (temp_sensor == NULL) return -1.0f;
    float temp_out = 0.0f;
    if (temperature_sensor_get_celsius(temp_sensor, &temp_out) == ESP_OK) {
        return temp_out;
    }
    return -1.0f;
}

// --- Command Dispatcher Architecture ---
typedef enum {
    NODE_TYPE_ANY = 0,
    NODE_TYPE_MASTER_ONLY,
    NODE_TYPE_LISTENER_ONLY
} api_node_req_t;

typedef void (*api_command_handler_t)(cJSON *value);

typedef struct {
    const char *key;
    api_command_handler_t handler;
    api_node_req_t node_req;
} api_command_t;

static void handle_buzzer_state(cJSON *value) {
    if (cJSON_IsBool(value)) {
        buzzer_set_state(cJSON_IsTrue(value));
        ESP_LOGI(TAG, "Buzzer state set to %d via API", cJSON_IsTrue(value));
    }
}

static void handle_buzzer_mode(cJSON *value) {
    if (cJSON_IsString(value)) {
        const char *mode = value->valuestring;
        ESP_LOGI(TAG, "Triggering buzzer mode: %s", mode);
        
        if (strcmp(mode, "pitch") == 0) {
            buzzer_play_pitch_effect();
        } else if (strcmp(mode, "chirp") == 0) {
            buzzer_play_chirp_effect();
        } else if (strcmp(mode, "fast_beeps") == 0) {
            buzzer_play_fast_beeps();
        } else if (strcmp(mode, "single_beep") == 0) {
            buzzer_play_single_beep();
        } else if (strcmp(mode, "siren") == 0) {
            buzzer_play_siren();
        } else if (strcmp(mode, "rumble") == 0) {
            buzzer_play_rumble();
        } else {
            ESP_LOGW(TAG, "Unknown buzzer mode: %s", mode);
        }
    }
}

static void handle_buzzer_volume(cJSON *value) {
    if (cJSON_IsNumber(value)) {
        int volume = value->valueint;
        if (volume >= 0 && volume <= 100) {
            buzzer_set_volume((uint8_t)volume);
            ESP_LOGI(TAG, "Buzzer volume set to %d via API", volume);
        }
    }
}

static void handle_led_identify(cJSON *value) {
    if (cJSON_IsTrue(value)) {
        ESP_LOGI(TAG, "LED Identify triggered via API");
        led_indicator_identify();
    }
}

// Add new command handlers here to scale the API
// Note: Order matters! Process configurations (like volume) before triggers (like pitch or state).
static const api_command_t api_commands[] = {
    {"buzzer_volume", handle_buzzer_volume, NODE_TYPE_MASTER_ONLY},
    {"buzzer_state", handle_buzzer_state, NODE_TYPE_MASTER_ONLY},
    {"buzzer_mode", handle_buzzer_mode, NODE_TYPE_MASTER_ONLY},
    {"led_identify", handle_led_identify, NODE_TYPE_ANY},
};
#define NUM_API_COMMANDS (sizeof(api_commands) / sizeof(api_commands[0]))

// --- Telemetry Provider Architecture ---
typedef void (*telemetry_provider_fn)(cJSON *root);

static void provide_shtc3_telemetry(cJSON *root) {
    if (!g_is_master_node) return;

    float temperature = 0.0f;
    float humidity = 0.0f;
    
    if (shtc3_read(&temperature, &humidity) == ESP_OK) {
        cJSON_AddNumberToObject(root, "temperature", temperature);
        cJSON_AddNumberToObject(root, "humidity", humidity);
    } else {
        ESP_LOGE(TAG, "Failed to read SHTC3 sensor");
    }
}

static void provide_cpu_telemetry(cJSON *root) {
    cJSON_AddNumberToObject(root, "cpu_temp", get_cpu_temp());
}

static void provide_node_id_telemetry(cJSON *root) {
    uint8_t mac[6];
    esp_read_mac(mac, ESP_MAC_WIFI_STA);
    char mac_str[18];
    snprintf(mac_str, sizeof(mac_str), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    cJSON_AddStringToObject(root, "node_id", mac_str);
}

static void provide_node_type_telemetry(cJSON *root) {
    cJSON_AddStringToObject(root, "node_type", g_is_master_node ? "master" : "listener");
}

// Add new telemetry providers here to scale the API outgoing metrics
static const telemetry_provider_fn telemetry_providers[] = {
    provide_shtc3_telemetry,
    provide_cpu_telemetry,
    provide_node_id_telemetry,
    provide_node_type_telemetry,
};
#define NUM_TELEMETRY_PROVIDERS (sizeof(telemetry_providers) / sizeof(telemetry_providers[0]))

static esp_websocket_client_handle_t ws_client;


static void websocket_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;
    switch (event_id) {
    case WEBSOCKET_EVENT_CONNECTED:
        ESP_LOGI(TAG, "WEBSOCKET_EVENT_CONNECTED");
        break;
    case WEBSOCKET_EVENT_DISCONNECTED:
        ESP_LOGI(TAG, "WEBSOCKET_EVENT_DISCONNECTED");
        break;
    case WEBSOCKET_EVENT_DATA:
        ESP_LOGI(TAG, "WEBSOCKET_EVENT_DATA");
        // Opcode 1 means text message
        if (data->op_code == 0x01 && data->data_len > 0) { 
            // Allocate a buffer to copy the payload and null terminate it
            char *json_str = malloc(data->data_len + 1);
            if (json_str) {
                memcpy(json_str, data->data_ptr, data->data_len);
                json_str[data->data_len] = '\0';
                ESP_LOGI(TAG, "Received JSON: %s", json_str);
                
                // Parse the JSON payload
                cJSON *root = cJSON_Parse(json_str);
                if (root != NULL) {
                    // Iterate through known commands and call their handler if present in payload
                    for (int i = 0; i < NUM_API_COMMANDS; i++) {
                        cJSON *cmd_val = cJSON_GetObjectItemCaseSensitive(root, api_commands[i].key);
                        if (cmd_val != NULL) {
                            bool can_execute = false;
                            if (api_commands[i].node_req == NODE_TYPE_ANY) can_execute = true;
                            else if (api_commands[i].node_req == NODE_TYPE_MASTER_ONLY && g_is_master_node) can_execute = true;
                            else if (api_commands[i].node_req == NODE_TYPE_LISTENER_ONLY && !g_is_master_node) can_execute = true;

                            if (can_execute) {
                                api_commands[i].handler(cmd_val);
                            } else {
                                ESP_LOGD(TAG, "Ignoring command %s for this node type", api_commands[i].key);
                            }
                        }
                    }
                    cJSON_Delete(root);
                }
                free(json_str);
            }
        }
        break;
    case WEBSOCKET_EVENT_ERROR:
        ESP_LOGI(TAG, "WEBSOCKET_EVENT_ERROR");
        break;
    }
}

static char websocket_url[64];

void api_client_init(void) {
    init_cpu_temp_sensor();
    
    snprintf(websocket_url, sizeof(websocket_url), "ws://%s:%d/ws", SERVER_IP, WEBSOCKET_PORT);
    
    ESP_LOGI(TAG, "Initializing WebSocket Client with URL: %s", websocket_url);
    esp_websocket_client_config_t websocket_cfg = {};
    websocket_cfg.uri = websocket_url;
    websocket_cfg.reconnect_timeout_ms = 5000;
    websocket_cfg.network_timeout_ms = 5000;
    websocket_cfg.ping_interval_sec = 10;

    ws_client = esp_websocket_client_init(&websocket_cfg);
    esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ANY, websocket_event_handler, (void *)ws_client);
    esp_websocket_client_start(ws_client);
}

void api_client_task(void *pvParameters) {
    ESP_LOGI(TAG, "WebSocket Telemetry Task Started");
    int consecutive_disconnects = 0;

    while (1) {
        if (esp_websocket_client_is_connected(ws_client)) {
            consecutive_disconnects = 0;
            // Create JSON object for telemetry
            cJSON *root = cJSON_CreateObject();
            if (root) {
                // Gather telemetry from all registered providers
                for (int i = 0; i < NUM_TELEMETRY_PROVIDERS; i++) {
                    telemetry_providers[i](root);
                }
                
                char *json_string = cJSON_PrintUnformatted(root);
                if (json_string) {
                    int bytes_sent = esp_websocket_client_send_text(ws_client, json_string, strlen(json_string), pdMS_TO_TICKS(500));
                    if (bytes_sent < 0) {
                        ESP_LOGE(TAG, "Failed to send telemetry. Socket might be dead. Forcing reconnect...");
                        esp_websocket_client_stop(ws_client);
                        esp_websocket_client_start(ws_client);
                    }
                    free(json_string); // Free the string created by cJSON_PrintUnformatted
                }
                cJSON_Delete(root);
            }
        } else {
            consecutive_disconnects++;
            if (consecutive_disconnects >= 3) {
                ESP_LOGW(TAG, "Websocket remains disconnected. Forcing restart of client...");
                esp_websocket_client_stop(ws_client);
                esp_websocket_client_start(ws_client);
                consecutive_disconnects = 0;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(API_TASK_DELAY_MS));
    }
}
