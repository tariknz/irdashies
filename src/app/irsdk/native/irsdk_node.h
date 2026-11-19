#ifndef IRSDK_NODE_H
#define IRSDK_NODE_H

#include <cstddef>
#include <vector>

#include <napi.h>
#include "./lib/irsdk_defines.h"
#include "./lib/irsdk_capture.h"

struct TelemetryDataViewCacheEntry
{
  Napi::ObjectReference object;
};

struct TelemetryVarCacheEntry
{
  Napi::ObjectReference object;
  Napi::Reference<Napi::ArrayBuffer> buffer;
  std::size_t dataSize;
  int offset;
  int count;
  int type;
  bool countAsTime;
  bool available;
  char name[IRSDK_MAX_STRING];
  char description[IRSDK_MAX_DESC];
  char unit[IRSDK_MAX_STRING];
};

class iRacingSdkNode : public Napi::ObjectWrap<iRacingSdkNode>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    iRacingSdkNode(const Napi::CallbackInfo& info);

private:
    // Properties
    Napi::Value GetCurrSessionDataVersion(const Napi::CallbackInfo &info);
    Napi::Value GetEnableLogging(const Napi::CallbackInfo &info);
    void SetEnableLogging(const Napi::CallbackInfo &info, const Napi::Value &value);

    // Methods
    // Control
    Napi::Value StartSdk(const Napi::CallbackInfo &info);
    Napi::Value StopSdk(const Napi::CallbackInfo &info);
    Napi::Value WaitForData(const Napi::CallbackInfo &info);
    Napi::Value BroadcastMessage(const Napi::CallbackInfo &info);
#ifdef IRDASHIES_TAPE_CONTROLS
    Napi::Value GetTapeReplayStatus(const Napi::CallbackInfo &info);
    Napi::Value SeekTapeReplay(const Napi::CallbackInfo &info);
    Napi::Value SetTapeReplaySpeed(const Napi::CallbackInfo &info);
    Napi::Value SetTapeReplayPaused(const Napi::CallbackInfo &info);
#endif
    // Getters
    Napi::Value IsRunning(const Napi::CallbackInfo &info);
    Napi::Value GetSessionVersionNum(const Napi::CallbackInfo &info);
    Napi::Value GetSessionData(const Napi::CallbackInfo &info);
    Napi::Value GetTelemetryData(const Napi::CallbackInfo &info);
    Napi::Value GetTelemetryDataView(const Napi::CallbackInfo &info);
    // Helpers
    Napi::Value __GetTelemetryTypes(const Napi::CallbackInfo &info);
    Napi::Value GetTelemetryVar(const Napi::CallbackInfo &info);

    Napi::Object GetTelemetryVarByIndex(const Napi::Env env, int index,
        const Napi::ArrayBuffer* frameBuffer = nullptr);
    Napi::Object GetTelemetryVar(const Napi::Env env, const char *varName);
    void ResetTelemetryCache();

    std::vector<TelemetryVarCacheEntry> _telemetryCache;
    Napi::ObjectReference _telemetryFrame;
    std::vector<TelemetryDataViewCacheEntry> _telemetryDataViewCache;
    Napi::ObjectReference _telemetryDataViewFrame;
    Napi::Reference<Napi::ArrayBuffer> _telemetryDataViewBuffer;
    bool _loggingEnabled;
    irsdk_capture _capture;
    int _sessionStatusID;
    int _lastSessionCt;
    const char* _sessionData;
};

#endif
