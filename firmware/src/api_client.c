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

static const char *TAG = "API_CLIENT";

static bool g_is_master_node = false;

void api_client_set_node_type(bool is_master) {
    g_is_master_node = is_master;
}


#define WEBSOCKET_URL "ws://192.168.3.65:8009/ws"
#define API_TASK_DELAY_MS 5000 // 5 seconds for telemetry

float get_cpu_temp(void) { return 42.0f; }

// --- Command Dispatcher Architecture ---
typedef void (*api_command_handler_t)(cJSON *value);

typedef struct {
    const char *key;
    api_command_handler_t handler;
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

// Add new command handlers here to scale the API
// Note: Order matters! Process configurations (like volume) before triggers (like pitch or state).
static const api_command_t api_commands[] = {
    {"buzzer_volume", handle_buzzer_volume},
    {"buzzer_state", handle_buzzer_state},
    {"buzzer_mode", handle_buzzer_mode},
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
                    if (g_is_master_node) {
                        // Iterate through known commands and call their handler if present in payload
                        for (int i = 0; i < NUM_API_COMMANDS; i++) {
                            cJSON *cmd_val = cJSON_GetObjectItemCaseSensitive(root, api_commands[i].key);
                            if (cmd_val != NULL) {
                                api_commands[i].handler(cmd_val);
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

void api_client_init(void) {
    ESP_LOGI(TAG, "Initializing WebSocket Client");
    esp_websocket_client_config_t websocket_cfg = {};
    websocket_cfg.uri = WEBSOCKET_URL;
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
