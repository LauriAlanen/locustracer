#include "wifi_manager.h"
#include "wifi_config.h"
#include "esp_wifi.h"
#include "esp_log.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "esp_now_prov.h"
#include <string.h>

static const char *TAG = "WIFI_MANAGER";

// Event Group used to track Wi-Fi connection state
static EventGroupHandle_t s_wifi_event_group;
#define WIFI_CONNECTED_BIT BIT0

static char s_ssid[33] = {0};
static char s_pass[65] = {0};
static uint8_t s_role = 0; // 0 = slave, 1 = master

static int s_retry_num = 0;
#define MAX_RETRY 10

static void connect_wifi(void)
{
    wifi_config_t wifi_config = {0};
    strncpy((char*)wifi_config.sta.ssid, s_ssid, sizeof(wifi_config.sta.ssid)-1);
    strncpy((char*)wifi_config.sta.password, s_pass, sizeof(wifi_config.sta.password)-1);

    ESP_LOGI(TAG, "Connecting to AP SSID: %s", s_ssid);
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_connect());
}

static void save_credentials_to_nvs(const char *ssid, const char *pass, uint8_t role)
{
    nvs_handle_t handle;
    if (nvs_open("wifi_prov", NVS_READWRITE, &handle) == ESP_OK) {
        nvs_set_str(handle, "ssid", ssid);
        nvs_set_str(handle, "pass", pass);
        nvs_set_u8(handle, "role", role);
        nvs_commit(handle);
        nvs_close(handle);
        ESP_LOGI(TAG, "Saved credentials to NVS. Role: %d", role);
    }
}

static void on_prov_creds_received(const char* ssid, const char* pass)
{
    ESP_LOGI(TAG, "Provisioning credentials received. Connecting...");
    strncpy(s_ssid, ssid, sizeof(s_ssid)-1);
    strncpy(s_pass, pass, sizeof(s_pass)-1);
    
    // Strict Single Master: Slaves remain slaves (s_role = 0) and do not broadcast.
    s_role = 0; 
    save_credentials_to_nvs(s_ssid, s_pass, s_role);
    
    connect_wifi();
}

static void on_prov_sweep_timeout(void)
{
    ESP_LOGI(TAG, "Sweep timeout, resuming Wi-Fi connection attempts...");
    s_retry_num = 0;
    connect_wifi();
}

static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                               int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        // Decide what to do based on presence of credentials
        if (strlen(s_ssid) > 0) {
            connect_wifi();
        } else {
            ESP_LOGI(TAG, "No credentials found, starting ESP-NOW provisioning as slave");
            esp_now_prov_set_creds_cb(on_prov_creds_received);
            esp_now_prov_set_timeout_cb(NULL); // No timeout needed on first boot without creds
            esp_now_prov_slave_start();
        }
    } 
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (strlen(s_ssid) > 0) {
            if (s_retry_num < MAX_RETRY) {
                esp_wifi_connect();
                s_retry_num++;
                ESP_LOGI(TAG, "Retry to connect to the AP (%d/%d)", s_retry_num, MAX_RETRY);
            } else {
                ESP_LOGW(TAG, "Failed to connect to AP %d times. Falling back to ESP-NOW provisioning sweep.", MAX_RETRY);
                esp_now_prov_set_creds_cb(on_prov_creds_received);
                esp_now_prov_set_timeout_cb(on_prov_sweep_timeout);
                esp_now_prov_slave_start();
            }
        }
        xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    } 
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP Address: " IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0; // Reset retries on successful connection
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
        
        // Start Master provisioning logic if role is Master
        if (s_role == 1) {
            esp_now_prov_master_start();
        } else {
            esp_now_prov_slave_monitor_start();
        }
    }
}

void wifi_manager_init(void)
{
    s_wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    
    esp_netif_t *sta_netif = esp_netif_create_default_wifi_sta();
    assert(sta_netif);

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_got_ip));

    // Check if hardcoded credentials exist (used for bootstrapping Master)
    if (strlen(WIFI_SSID) > 0) {
        ESP_LOGI(TAG, "Bootstrapping master from wifi_config.h (Overrides NVS)");
        strncpy(s_ssid, WIFI_SSID, sizeof(s_ssid)-1);
        strncpy(s_pass, WIFI_PASS, sizeof(s_pass)-1);
        s_role = 1;
        
        // Save these to NVS so they persist when firmware is updated without hardcoded creds
        save_credentials_to_nvs(s_ssid, s_pass, s_role);
    } else {
        // Fallback to checking NVS for stored credentials
        nvs_handle_t handle;
        if (nvs_open("wifi_prov", NVS_READONLY, &handle) == ESP_OK) {
            size_t len = sizeof(s_ssid);
            nvs_get_str(handle, "ssid", s_ssid, &len);
            len = sizeof(s_pass);
            nvs_get_str(handle, "pass", s_pass, &len);
            nvs_get_u8(handle, "role", &s_role);
            nvs_close(handle);
        }
    }

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_start());
    
    // Disable Wi-Fi modem sleep to ensure TSF clock is not gated or delayed
    ESP_ERROR_CHECK(esp_wifi_set_ps(WIFI_PS_NONE));
}

void wifi_wait_for_connection(void)
{
    // Wait forever until WIFI_CONNECTED_BIT is set
    xEventGroupWaitBits(s_wifi_event_group, WIFI_CONNECTED_BIT,
                        pdFALSE, pdTRUE, portMAX_DELAY);
}

bool wifi_is_connected(void)
{
    if (s_wifi_event_group == NULL) {
        return false;
    }
    return (xEventGroupGetBits(s_wifi_event_group) & WIFI_CONNECTED_BIT) != 0;
}

void wifi_manager_start_provisioning(void)
{
    ESP_LOGI(TAG, "Forcing ESP-NOW provisioning sweep...");
    
    memset(s_ssid, 0, sizeof(s_ssid));
    memset(s_pass, 0, sizeof(s_pass));
    
    nvs_handle_t handle;
    if (nvs_open("wifi_prov", NVS_READWRITE, &handle) == ESP_OK) {
        nvs_erase_key(handle, "ssid");
        nvs_erase_key(handle, "pass");
        nvs_commit(handle);
        nvs_close(handle);
    }
    
    esp_wifi_disconnect();
    
    esp_now_prov_set_creds_cb(on_prov_creds_received);
    esp_now_prov_set_timeout_cb(on_prov_sweep_timeout);
    esp_now_prov_slave_start();
}
