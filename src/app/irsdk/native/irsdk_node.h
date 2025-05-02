#ifndef IRSDK_NODE_H
#define IRSDK_NODE_H

#include <napi.h>
#include "../lib/irsdk_defines.h"
#include "../lib/irsdk_client.h"

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
    // Getters
    Napi::Value IsRunning(const Napi::CallbackInfo &info);
    Napi::Value GetSessionVersionNum(const Napi::CallbackInfo &info);
    Napi::Value GetSessionData(const Napi::CallbackInfo &info);
    Napi::Value GetTelemetryData(const Napi::CallbackInfo &info);
    // Helpers
    Napi::Value __GetTelemetryTypes(const Napi::CallbackInfo &info);
    Napi::Value GetTelemetryVar(const Napi::CallbackInfo &info);

    bool GetTelemetryBool(int entry, int index);
    int GetTelemetryInt(int entry, int index);
    float GetTelemetryFloat(int entry, int index);
    double GetTelemetryDouble(int entry, int index);
    Napi::Object GetTelemetryVarByIndex(const Napi::Env env, int index);
    Napi::Object GetTelemetryVar(const Napi::Env env, const char *varName);

    bool _loggingEnabled;
    char* _data;
    int _bufLineLen;
    int _sessionStatusID;
    int _lastSessionCt;
    const char* _sessionData;
};

#endif
