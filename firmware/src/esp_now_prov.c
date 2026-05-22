#include "esp_now_prov.h"
#include "esp_now.h"
#include "esp_wifi.h"
#include "esp_log.h"
#include "esp_mac.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "wifi_config.h"
#include <string.h>

static const char *TAG = "ESP_NOW_PROV";

typedef enum {
    PROV_MSG_DISCOVER = 1,
    PROV_MSG_OFFER,
    PROV_MSG_CREDS_REQ,
    PROV_MSG_CREDS_RESP,
    PROV_MSG_HEARTBEAT
} prov_msg_type_t;

typedef struct __attribute__((packed)) {
    uint8_t type;
} prov_msg_heartbeat_t;

typedef struct __attribute__((packed)) {
    uint8_t type;
} prov_msg_discover_t;

typedef struct __attribute__((packed)) {
    uint8_t type;
} prov_msg_offer_t;

typedef struct __attribute__((packed)) {
    uint8_t type;
} prov_msg_creds_req_t;

typedef struct __attribute__((packed)) {
    uint8_t type;
    char ssid[33];
    char pass[65];
} prov_msg_creds_resp_t;

typedef struct {
    uint8_t mac[6];
    uint8_t *data;
    int data_len;
} esp_now_event_t;

static QueueHandle_t s_esp_now_queue = NULL;
static esp_now_prov_creds_cb_t s_creds_cb = NULL;
static esp_now_prov_timeout_cb_t s_timeout_cb = NULL;
static bool s_is_master = false;
static bool s_is_esp_now_initialized = false;

static uint8_t s_broadcast_mac[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
static uint8_t s_master_mac[6] = {0};
static bool s_slave_got_offer = false;
static bool s_is_monitor_running = false;

// Shared LMK and PMK from wifi_config.h. If not defined, fallback to defaults
#ifndef ESPNOW_PMK
#define ESPNOW_PMK "locustracer_pmk1"
#endif
#ifndef ESPNOW_LMK
#define ESPNOW_LMK "locustracer_lmk1"
#endif

void esp_now_prov_set_creds_cb(esp_now_prov_creds_cb_t cb)
{
    s_creds_cb = cb;
}

void esp_now_prov_set_timeout_cb(esp_now_prov_timeout_cb_t cb)
{
    s_timeout_cb = cb;
}

static volatile uint32_t s_last_heartbeat_tick = 0;

static void esp_now_recv_cb(const esp_now_recv_info_t *recv_info, const uint8_t *data, int len)
{
    if (len > 0 && data[0] == PROV_MSG_HEARTBEAT) {
        s_last_heartbeat_tick = xTaskGetTickCount();
        memcpy(s_master_mac, recv_info->src_addr, 6);
        return;
    }

    if (s_esp_now_queue == NULL) return;
    
    esp_now_event_t evt;
    memcpy(evt.mac, recv_info->src_addr, 6);
    evt.data = malloc(len);
    if (evt.data == NULL) return;
    memcpy(evt.data, data, len);
    evt.data_len = len;

    if (xQueueSend(s_esp_now_queue, &evt, 0) != pdTRUE) {
        free(evt.data);
    }
}

static void add_encrypted_peer(const uint8_t *mac)
{
    if (esp_now_is_peer_exist(mac)) {
        return; // Already added
    }
    esp_now_peer_info_t peer = {};
    memcpy(peer.peer_addr, mac, 6);
    peer.channel = 0; // Use current channel
    peer.ifidx = WIFI_IF_STA;
    peer.encrypt = true;
    memcpy(peer.lmk, ESPNOW_LMK, 16);
    esp_now_add_peer(&peer);
    ESP_LOGI(TAG, "Added encrypted peer " MACSTR, MAC2STR(mac));
}

static void master_task(void *pvParameter)
{
    esp_now_event_t evt;
    uint32_t last_hb = xTaskGetTickCount();
    
    while (1) {
        uint32_t now = xTaskGetTickCount();
        uint32_t elapsed = (now - last_hb) * portTICK_PERIOD_MS;
        uint32_t wait_ms = (elapsed < 5000) ? (5000 - elapsed) : 0;
        
        if (xQueueReceive(s_esp_now_queue, &evt, pdMS_TO_TICKS(wait_ms)) == pdTRUE) {
            uint8_t type = evt.data[0];
            
            if (type == PROV_MSG_DISCOVER) {
                ESP_LOGI(TAG, "Received DISCOVER from " MACSTR, MAC2STR(evt.mac));
                // Add slave as encrypted peer
                add_encrypted_peer(evt.mac);
                
                // Send OFFER via broadcast so slave receives it unencrypted
                prov_msg_offer_t offer;
                offer.type = PROV_MSG_OFFER;
                esp_now_send(s_broadcast_mac, (uint8_t*)&offer, sizeof(offer));
            } 
            else if (type == PROV_MSG_CREDS_REQ) {
                ESP_LOGI(TAG, "Received CREDS_REQ from " MACSTR, MAC2STR(evt.mac));
                prov_msg_creds_resp_t resp = {};
                resp.type = PROV_MSG_CREDS_RESP;
                
                wifi_config_t conf;
                if (esp_wifi_get_config(WIFI_IF_STA, &conf) == ESP_OK) {
                    strncpy(resp.ssid, (char*)conf.sta.ssid, sizeof(resp.ssid)-1);
                    strncpy(resp.pass, (char*)conf.sta.password, sizeof(resp.pass)-1);
                    ESP_LOGI(TAG, "Sending encrypted credentials to " MACSTR, MAC2STR(evt.mac));
                    esp_now_send(evt.mac, (uint8_t*)&resp, sizeof(resp));
                }
            }
            free(evt.data);
        }
        
        now = xTaskGetTickCount();
        if ((now - last_hb) * portTICK_PERIOD_MS >= 5000) {
            prov_msg_heartbeat_t hb = { .type = PROV_MSG_HEARTBEAT };
            esp_now_send(s_broadcast_mac, (uint8_t*)&hb, sizeof(hb));
            last_hb = now;
        }
    }
}

static void slave_task(void *pvParameter)
{
    esp_now_event_t evt;
    uint8_t channel = 1;
    int sweep_count = 0;
    
    while (!s_slave_got_offer) {
        // Sweep channels
        esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE);
        ESP_LOGD(TAG, "Sweeping channel %d", channel);
        
        prov_msg_discover_t req;
        req.type = PROV_MSG_DISCOVER;
        esp_now_send(s_broadcast_mac, (uint8_t*)&req, sizeof(req));
        
        // Wait for offer for 400ms
        if (xQueueReceive(s_esp_now_queue, &evt, pdMS_TO_TICKS(400)) == pdTRUE) {
            if (evt.data[0] == PROV_MSG_OFFER) {
                ESP_LOGI(TAG, "Received OFFER from Master " MACSTR " on channel %d", MAC2STR(evt.mac), channel);
                memcpy(s_master_mac, evt.mac, 6);
                s_slave_got_offer = true;
                add_encrypted_peer(s_master_mac);
                
                // Send CREDS_REQ
                prov_msg_creds_req_t cred_req;
                cred_req.type = PROV_MSG_CREDS_REQ;
                esp_now_send(s_master_mac, (uint8_t*)&cred_req, sizeof(cred_req));
            }
            free(evt.data);
        } else {
            channel++;
            if (channel > 13) {
                channel = 1;
                sweep_count++;
                if (sweep_count >= 3) { // 3 sweeps across all channels
                    ESP_LOGI(TAG, "Provisioning sweep timeout. No master found.");
                    if (s_timeout_cb) s_timeout_cb();
                    vTaskDelete(NULL);
                    return;
                }
            }
        }
    }
    
    // Wait for CREDS_RESP with a 5-second timeout
    if (xQueueReceive(s_esp_now_queue, &evt, pdMS_TO_TICKS(5000)) == pdTRUE) {
        if (evt.data[0] == PROV_MSG_CREDS_RESP && memcmp(evt.mac, s_master_mac, 6) == 0) {
            prov_msg_creds_resp_t *resp = (prov_msg_creds_resp_t *)evt.data;
            ESP_LOGI(TAG, "Received credentials: SSID=%s", resp->ssid);
            
            if (s_creds_cb) {
                s_creds_cb(resp->ssid, resp->pass);
            }
        } else {
            if (s_timeout_cb) s_timeout_cb();
        }
        free(evt.data);
    } else {
        ESP_LOGE(TAG, "Timeout waiting for CREDS_RESP");
        if (s_timeout_cb) s_timeout_cb();
    }
    
    vTaskDelete(NULL);
}

static void esp_now_init_common(void)
{
    if (s_is_esp_now_initialized) {
        return;
    }

    if (s_esp_now_queue == NULL) {
        s_esp_now_queue = xQueueCreate(10, sizeof(esp_now_event_t));
    }
    
    esp_err_t err = esp_now_init();
    if (err != ESP_OK && err != ESP_ERR_ESPNOW_EXIST) {
        ESP_ERROR_CHECK(err);
    }
    
    // Ignore error if already registered
    esp_now_register_recv_cb(esp_now_recv_cb);
    esp_now_set_pmk((uint8_t *)ESPNOW_PMK);
    
    // Add broadcast peer for unencrypted traffic
    esp_now_peer_info_t bcast = {};
    memset(bcast.peer_addr, 0xFF, 6);
    bcast.channel = 0;
    bcast.ifidx = WIFI_IF_STA;
    bcast.encrypt = false;
    
    if (!esp_now_is_peer_exist(bcast.peer_addr)) {
        ESP_ERROR_CHECK(esp_now_add_peer(&bcast));
    }

    s_is_esp_now_initialized = true;
}

void esp_now_prov_master_start(void)
{
    s_is_master = true;
    esp_now_init_common();
    xTaskCreate(master_task, "prov_master_task", 4096, NULL, 5, NULL);
    ESP_LOGI(TAG, "ESP-NOW Provisioning Master started");
}

void esp_now_prov_slave_start(void)
{
    s_is_master = false;
    s_slave_got_offer = false;
    esp_now_init_common();
    xTaskCreate(slave_task, "prov_slave_task", 4096, NULL, 5, NULL);
    ESP_LOGI(TAG, "ESP-NOW Provisioning Slave started");
}

static void slave_monitor_task(void *pvParameter)
{
    esp_now_event_t evt;
    
    s_is_monitor_running = true;
    s_last_heartbeat_tick = xTaskGetTickCount();
    
    while (1) {
        // Clear queue to prevent overflow while we're monitoring
        while (xQueueReceive(s_esp_now_queue, &evt, 0) == pdTRUE) {
            free(evt.data);
        }
        
        vTaskDelay(pdMS_TO_TICKS(1000));
        
        uint32_t now = xTaskGetTickCount();
        uint32_t elapsed = (now - s_last_heartbeat_tick) * portTICK_PERIOD_MS;
        
        if (elapsed > 15000) {
            ESP_LOGW(TAG, "Lost heartbeat from Master! Disconnecting and restarting sweep...");
            
            extern void wifi_manager_start_provisioning(void);
            wifi_manager_start_provisioning();
            
            break;
        }
    }
    s_is_monitor_running = false;
    vTaskDelete(NULL);
}

void esp_now_prov_slave_monitor_start(void)
{
    if (s_is_monitor_running) return;
    esp_now_init_common();
    xTaskCreate(slave_monitor_task, "prov_slave_mon", 4096, NULL, 5, NULL);
    ESP_LOGI(TAG, "ESP-NOW Slave Monitor started");
}
