#include "api_client.h"
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_log.h"
#include "esp_websocket_client.h"
#include "cJSON.h"

static const char *TAG = "API_CLIENT";

#define WEBSOCKET_URL "ws://192.168.3.65:8009/ws"
#define API_TASK_DELAY_MS 5000 // 5 seconds for telemetry

// Dummy hardware callbacks implementation
float get_sensor_temp(void) { return 24.5f; }
float get_sensor_humidity(void) { return 55.0f; }
float get_cpu_temp(void) { return 42.0f; }
void trigger_buzzer(void) { ESP_LOGI(TAG, "Buzzer triggered in REAL TIME!"); }

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
                    cJSON *buzzer_cmd = cJSON_GetObjectItemCaseSensitive(root, "trigger_buzzer");
                    if (cJSON_IsTrue(buzzer_cmd)) {
                        trigger_buzzer();
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

    ws_client = esp_websocket_client_init(&websocket_cfg);
    esp_websocket_register_events(ws_client, WEBSOCKET_EVENT_ANY, websocket_event_handler, (void *)ws_client);
    esp_websocket_client_start(ws_client);
}

void api_client_task(void *pvParameters) {
    ESP_LOGI(TAG, "WebSocket Telemetry Task Started");

    while (1) {
        if (esp_websocket_client_is_connected(ws_client)) {
            // Create JSON object for telemetry
            cJSON *root = cJSON_CreateObject();
            if (root) {
                cJSON_AddNumberToObject(root, "temperature", get_sensor_temp());
                cJSON_AddNumberToObject(root, "humidity", get_sensor_humidity());
                cJSON_AddNumberToObject(root, "cpu_temp", get_cpu_temp());
                
                char *json_string = cJSON_PrintUnformatted(root);
                if (json_string) {
                    esp_websocket_client_send_text(ws_client, json_string, strlen(json_string), portMAX_DELAY);
                    free(json_string); // Free the string created by cJSON_PrintUnformatted
                }
                cJSON_Delete(root);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(API_TASK_DELAY_MS));
    }
}
