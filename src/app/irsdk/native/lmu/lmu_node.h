#ifndef LMU_NODE_H
#define LMU_NODE_H

#include <napi.h>
#include <map>
#include <string>
#include "lmu_struct.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>

class LmuSdkNode : public Napi::ObjectWrap<LmuSdkNode>
{
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    LmuSdkNode(const Napi::CallbackInfo &info);
    ~LmuSdkNode();

private:
    Napi::Value Start(const Napi::CallbackInfo &info);
    Napi::Value Stop(const Napi::CallbackInfo &info);
    Napi::Value IsRunning(const Napi::CallbackInfo &info);
    Napi::Value Read(const Napi::CallbackInfo &info);
    Napi::Value ReadSession(const Napi::CallbackInfo &info);

    int GetClassId(const char *className) const;
    const LMUVehicleTelemetry *GetPlayerTelemetry() const;
    const LMUVehicleTelemetry *GetVehicleTelemetryById(int id) const;
    bool CaptureSnapshot();
    bool IsLive() const;
    int VehicleCount() const;
    void FillVehicleArrays(Napi::Object &out) const;
    void Unmap();

    HANDLE _hMap;
    uint8_t *_view;
    const LMUObjectOut *_mapped;
    LMUObjectOut _snapshot;
    bool _hasSnapshot;
    mutable std::map<std::string, int> _classIds;
};

#endif