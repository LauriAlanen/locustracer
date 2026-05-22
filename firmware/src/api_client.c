#include "api_client.h"
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_http_client.h"
#include "cJSON.h"

static const char *TAG = "API_CLIENT";

// Configurable URLs
// TODO: Replace YOUR_COMPUTER_IP with your machine's actual local IP address (e.g., 192.168.3.x)
#define API_POST_URL "http://192.168.3.65:8009/telemetry"
#define API_GET_URL  "http://192.168.3.65:8009/config"

// Task configuration
#define API_TASK_DELAY_MS 5000 // 5 seconds

// Dummy hardware callbacks implementation
float get_sensor_temp(void) {
    return 24.5f; // Dummy value
}

float get_sensor_humidity(void) {
    return 55.0f; // Dummy value
}

float get_cpu_temp(void) {
    return 42.0f; // Dummy value
}

void trigger_buzzer(void) {
    ESP_LOGI(TAG, "Buzzer triggered!");
}

/**
 * @brief HTTP Event Handler
 */
esp_err_t _http_event_handler(esp_http_client_event_t *evt) {
    switch (evt->event_id) {
        case HTTP_EVENT_ERROR:
            ESP_LOGD(TAG, "HTTP_EVENT_ERROR");
            break;
        case HTTP_EVENT_ON_CONNECTED:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_CONNECTED");
            break;
        case HTTP_EVENT_HEADER_SENT:
            ESP_LOGD(TAG, "HTTP_EVENT_HEADER_SENT");
            break;
        case HTTP_EVENT_ON_HEADER:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_HEADER, key=%s, value=%s", evt->header_key, evt->header_value);
            break;
        case HTTP_EVENT_ON_DATA:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
            break;
        case HTTP_EVENT_ON_FINISH:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_FINISH");
            break;
        case HTTP_EVENT_DISCONNECTED:
            ESP_LOGD(TAG, "HTTP_EVENT_DISCONNECTED");
            break;
        case HTTP_EVENT_REDIRECT:
            ESP_LOGD(TAG, "HTTP_EVENT_REDIRECT");
            break;
        case HTTP_EVENT_ON_HEADERS_COMPLETE:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_HEADERS_COMPLETE");
            break;
        case HTTP_EVENT_ON_STATUS_CODE:
            ESP_LOGD(TAG, "HTTP_EVENT_ON_STATUS_CODE, status=%d", esp_http_client_get_status_code(evt->client));
            break;
    }
    return ESP_OK;
}

/**
 * @brief Push telemetry data via POST
 */
static void api_client_push_telemetry(void) {
    ESP_LOGI(TAG, "Pushing telemetry data...");

    // Create JSON object
    cJSON *root = cJSON_CreateObject();
    if (root == NULL) {
        ESP_LOGE(TAG, "Failed to create JSON root object (heap out of memory)");
        return;
    }

    // Add data nodes
    cJSON_AddNumberToObject(root, "temperature", get_sensor_temp());
    cJSON_AddNumberToObject(root, "humidity", get_sensor_humidity());
    cJSON_AddNumberToObject(root, "cpu_temp", get_cpu_temp());

    // Convert JSON to string
    char *json_string = cJSON_PrintUnformatted(root);
    
    // Memory cleanup for cJSON object
    cJSON_Delete(root);

    if (json_string == NULL) {
        ESP_LOGE(TAG, "Failed to print JSON string");
        return;
    }

    // Setup HTTP client
    esp_http_client_config_t config = {
        .url = API_POST_URL,
        .event_handler = _http_event_handler,
        .timeout_ms = 10000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client");
        free(json_string);
        return;
    }

    esp_http_client_set_method(client, HTTP_METHOD_POST);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "Connection", "close");
    esp_http_client_set_post_field(client, json_string, strlen(json_string));

    // Perform the request
    esp_err_t err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "POST HTTP Status = %d, content_length = %lld",
                 esp_http_client_get_status_code(client),
                 (long long)esp_http_client_get_content_length(client));
    } else {
        ESP_LOGE(TAG, "HTTP POST request failed: %s", esp_err_to_name(err));
    }

    // Cleanup
    esp_http_client_cleanup(client);
    free(json_string); // Free the string created by cJSON_PrintUnformatted
}

/**
 * @brief Pull configuration via GET
 */
static void api_client_pull_config(void) {
    ESP_LOGI(TAG, "Pulling configuration data...");

    // Setup HTTP client
    esp_http_client_config_t config = {
        .url = API_GET_URL,
        .event_handler = _http_event_handler,
        .timeout_ms = 10000,
    };
    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (client == NULL) {
        ESP_LOGE(TAG, "Failed to initialize HTTP client");
        return;
    }

    esp_http_client_set_header(client, "Connection", "close");

    esp_err_t err;
    if ((err = esp_http_client_open(client, 0)) != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open HTTP connection: %s", esp_err_to_name(err));
        esp_http_client_cleanup(client);
        return;
    }

    int content_length = esp_http_client_fetch_headers(client);
    if (content_length <= 0) {
        // If the server doesn't return Content-Length, assume a max size
        content_length = 2048;
    }

    char *buffer = (char *)malloc(content_length + 1);
    if (buffer == NULL) {
        ESP_LOGE(TAG, "Failed to allocate memory for HTTP response");
        esp_http_client_close(client);
        esp_http_client_cleanup(client);
        return;
    }

    int total_read_len = 0;
    int read_len = 0;
    while (1) {
        read_len = esp_http_client_read(client, buffer + total_read_len, content_length - total_read_len);
        if (read_len <= 0) {
            break;
        }
        total_read_len += read_len;
        if (total_read_len >= content_length) {
            break;
        }
    }
    buffer[total_read_len] = '\0'; // Null-terminate

    int status_code = esp_http_client_get_status_code(client);
    if (status_code == 200 && total_read_len > 0) {
        ESP_LOGI(TAG, "Received payload: %s", buffer);

        // Parse JSON
        cJSON *root = cJSON_Parse(buffer);
        if (root != NULL) {
            // Check for buzzer command
            cJSON *buzzer_cmd = cJSON_GetObjectItemCaseSensitive(root, "trigger_buzzer");
            if (cJSON_IsTrue(buzzer_cmd)) {
                trigger_buzzer();
            }

            // Cleanup JSON
            cJSON_Delete(root);
        } else {
            ESP_LOGE(TAG, "Failed to parse JSON payload");
        }
    } else {
        ESP_LOGE(TAG, "HTTP GET request failed or empty, status code: %d", status_code);
    }

    // Cleanup
    free(buffer);
    esp_http_client_close(client);
    esp_http_client_cleanup(client);
}

void api_client_init(void) {
    ESP_LOGI(TAG, "Initializing API Client");
}

void api_client_task(void *pvParameters) {
    ESP_LOGI(TAG, "API Client Task Started");

    while (1) {
        // Perform GET request
        api_client_pull_config();

        // Small delay between requests
        vTaskDelay(pdMS_TO_TICKS(1000));

        // Perform POST request
        api_client_push_telemetry();

        // Wait for the next interval
        vTaskDelay(pdMS_TO_TICKS(API_TASK_DELAY_MS));
    }
}
