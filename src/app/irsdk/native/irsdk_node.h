#ifndef IRSDK_NODE_H
#define IRSDK_NODE_H

#include <napi.h>
#include "./lib/irsdk_defines.h"
#include "./lib/irsdk_capture.h"

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
    // Helpers
    Napi::Value __GetTelemetryTypes(const Napi::CallbackInfo &info);
    Napi::Value GetTelemetryVar(const Napi::CallbackInfo &info);

    Napi::Object GetTelemetryVarByIndex(const Napi::Env env, int index);
    Napi::Object GetTelemetryVar(const Napi::Env env, const char *varName);

    bool _loggingEnabled;
    irsdk_capture _capture;
    int _sessionStatusID;
    int _lastSessionCt;
    const char* _sessionData;
};

#endif
