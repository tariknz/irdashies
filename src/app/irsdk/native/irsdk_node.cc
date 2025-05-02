#include "./irsdk_node.h"
#include "../lib/yaml_parser.h"

/*
Nan::SetPrototypeMethod(tmpl, "getSessionData", GetSessionData);
Nan::SetPrototypeMethod(tmpl, "getSessionVersionNum", GetSessionVersionNum);
Nan::SetPrototypeMethod(tmpl, "getTelemetryData", GetTelemetryData);
Nan::SetPrototypeMethod(tmpl, "broadcast", BroadcastMessage);
Nan::SetPrototypeMethod(tmpl, "__getTelemetryTypes", __GetTelemetryTypes);
*/

// ---------------------------
// Constructors
// ---------------------------
Napi::Object iRacingSdkNode::Init(Napi::Env env, Napi::Object exports)
{
  Napi::Function func = DefineClass(env, "iRacingSdkNode", {
    // Properties
    InstanceAccessor<&iRacingSdkNode::GetCurrSessionDataVersion>("currDataVersion"),
    InstanceAccessor<&iRacingSdkNode::GetEnableLogging, &iRacingSdkNode::SetEnableLogging>("enableLogging"),
    // Methods
    //Control
    InstanceMethod<&iRacingSdkNode::StartSdk>("startSDK"),
    InstanceMethod("stopSDK", &iRacingSdkNode::StopSdk),
    InstanceMethod("waitForData", &iRacingSdkNode::WaitForData),
    InstanceMethod("broadcast", &iRacingSdkNode::BroadcastMessage),
    // Getters
    InstanceMethod("isRunning", &iRacingSdkNode::IsRunning),
    InstanceMethod("getSessionVersionNum", &iRacingSdkNode::GetSessionVersionNum),
    InstanceMethod("getSessionData", &iRacingSdkNode::GetSessionData),
    InstanceMethod("getTelemetryData", &iRacingSdkNode::GetTelemetryData),
    InstanceMethod("getTelemetryVariable", &iRacingSdkNode::GetTelemetryVar),
    // Helpers
    InstanceMethod("__getTelemetryTypes", &iRacingSdkNode::__GetTelemetryTypes)
  });

  Napi::FunctionReference* constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("iRacingSdkNode", func);
  return exports;
}

iRacingSdkNode::iRacingSdkNode(const Napi::CallbackInfo &info)
  : Napi::ObjectWrap<iRacingSdkNode>(info)
  , _data(NULL)
  , _bufLineLen(0)
  , _sessionStatusID(0)
  , _lastSessionCt(-1)
  , _sessionData(NULL)
  , _loggingEnabled(false)
{
  printf("Initializing cpp class instance...\n");
}

// ---------------------------
// Property implementations
// ---------------------------
Napi::Value iRacingSdkNode::GetCurrSessionDataVersion(const Napi::CallbackInfo &info)
{
  int ver = this->_lastSessionCt;
  return Napi::Number::New(info.Env(), ver);
}

Napi::Value iRacingSdkNode::GetEnableLogging(const Napi::CallbackInfo &info)
{
  bool enabled = this->_loggingEnabled;
  return Napi::Boolean::New(info.Env(), enabled);
}

void iRacingSdkNode::SetEnableLogging(const Napi::CallbackInfo &info, const Napi::Value &value)
{
  Napi::Boolean enable;
  if (info.Length() <= 0 || !info[0].IsBoolean()) {
    enable = Napi::Boolean::New(info.Env(), false);
  } else {
    enable = info[0].As<Napi::Boolean>();
  }
  printf("Setting logging enabled: %i\n", info[0]);
  this->_loggingEnabled = enable;
}

// ---------------------------
// Instance implementations
// ---------------------------
// SDK Control
Napi::Value iRacingSdkNode::StartSdk(const Napi::CallbackInfo &info)
{
  printf("Starting SDK...\n");
  if (!irsdk_isConnected()) {
    bool result = irsdk_startup();
    printf("Connected at least! %i\n", result);
    return Napi::Boolean::New(info.Env(), result);
  }
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value iRacingSdkNode::StopSdk(const Napi::CallbackInfo &info)
{
  irsdk_shutdown();
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value iRacingSdkNode::WaitForData(const Napi::CallbackInfo &info)
{
  // Figure out the time to wait
  // This will default to the timeout set on the class
  Napi::Number timeout;
  if (info.Length() <= 0 || !info[0].IsNumber()) {
    timeout = Napi::Number::New(info.Env(), 16);
  } else {
    timeout = info[0].As<Napi::Number>();
  }

  if (!irsdk_isConnected() && !irsdk_startup()) {
    return Napi::Boolean::New(info.Env(), false);
  }

  // @todo: try to do this async instead
  const irsdk_header* header = irsdk_getHeader();

  // @todo: This isn't the best way of doing this. Need to improve, but this works for now
  if (!this->_data) {
    this->_data = new char[header->bufLen];
  }

  // wait for start of sesh or new data
  bool dataReady = irsdk_waitForDataReady(timeout, this->_data);
  if (dataReady && header)
  {
    if (this->_loggingEnabled) ("Session started or we have new data.\n");

    // New connection or data changed length
    if (this->_bufLineLen != header->bufLen) {
      if (this->_loggingEnabled) printf("Connection started / data changed length.\n");

      this->_bufLineLen = header->bufLen;

      // Increment connection
      this->_sessionStatusID++;

      // Reset info str status
      this->_lastSessionCt = -1;
      return Napi::Boolean::New(info.Env(), true);
    } else if (this->_data) {
      if (this->_loggingEnabled) printf("Data initialized and ready to process.\n");
      // already initialized and ready to process
      return Napi::Boolean::New(info.Env(), true);
    }
  }
  else if (!(this->_data != NULL && irsdk_isConnected()))
  {
    printf("Session ended. Cleaning up.\n");
    // Session ended
    if (this->_data) delete[] this->_data;
    this->_data = NULL;

    // Reset Info str
    this->_lastSessionCt = -1;
  }
  printf("Session ended or something went wrong. Not successful.\n");
  return Napi::Boolean::New(info.Env(), false);
}

Napi::Value iRacingSdkNode::BroadcastMessage(const Napi::CallbackInfo &info)
{
  auto env = info.Env();

  // Determine message type
  if (info.Length() <= 2 || !info[0].IsNumber()) {
    return Napi::Boolean::New(env, false);
  }

  if (info.Length() == 4 && !info[2].IsNumber()) {
    return Napi::Boolean::New(env, false);
  }

  int msgEnumIndex = info[0].As<Napi::Number>();
  irsdk_BroadcastMsg msgType = static_cast<irsdk_BroadcastMsg>(msgEnumIndex);

  // Args
  int arg1 = info[1].As<Napi::Number>();
  auto arg2 = info[2].As<Napi::Number>();
  auto arg3 = info[3].As<Napi::Number>();

  // these defs are in irsdk_defines.cpp
  switch (msgType)
  {
  // irsdk_BroadcastMsg msg, int arg1, int arg2, int var3
  case irsdk_BroadcastCamSwitchPos: // @todo we need to use irsdk_padCarNum for arg1
  case irsdk_BroadcastCamSwitchNum:
    printf("BroadcastMessage(msgType: %d, arg1: %d, arg2: %d, arg3: %d)\n", msgType, arg1, arg2.Int32Value(), arg3.Int32Value());
    irsdk_broadcastMsg(msgType, arg1, arg2, arg3);
    break;
  
  // irsdk_BroadcastMsg msg, int arg1, int unused, int unused
  case irsdk_BroadcastReplaySearch: // arg1 == irsdk_RpySrchMode
  case irsdk_BroadcastReplaySetState: // arg1 == irsdk_RpyStateMode
  case irsdk_BroadcastCamSetState: // arg1 == irsdk_CameraState
  case irsdk_BroadcastTelemCommand: // arg1 == irsdk_TelemCommandMode
  case irsdk_BroadcastVideoCapture: // arg1 == irsdk_VideoCaptureMode
    printf("BroadcastMessage(msgType: %d, arg1: %d, arg2: -1, arg3: -1)\n", msgType, arg1);
    irsdk_broadcastMsg(msgType, arg1, -1, -1);
    break;

  // irsdk_BroadcastMsg msg, int arg1, int arg2, int unused
  case irsdk_BroadcastReloadTextures: // arg1 == irsdk_ReloadTexturesMode
  case irsdk_BroadcastChatComand: // arg1 == irsdk_ChatCommandMode
  case irsdk_BroadcastReplaySetPlaySpeed:
    printf("BroadcastMessage(msgType: %d, arg1: %d, arg2: %d, arg3: -1)\n", msgType, arg1, arg2.Int32Value());
    irsdk_broadcastMsg(msgType, arg1, arg2, -1);
    break;
  
  // irsdk_BroadcastMsg msg, int arg1, float arg2
  case irsdk_BroadcastPitCommand: // arg1 == irsdk_PitCommandMode
  case irsdk_BroadcastFFBCommand: // arg1 == irsdk_FFBCommandMode
  case irsdk_BroadcastReplaySearchSessionTime:
  case irskd_BroadcastReplaySetPlayPosition:
    printf("BroadcastMessage(msgType: %d, arg1: %d, arg2: %f)\n", msgType, arg1, (float)arg2.FloatValue());
    irsdk_broadcastMsg(msgType, arg1, (float)arg2.FloatValue());
    break;

  default:
    printf("Attempted to broadcast an unsupported message.");
    return Napi::Boolean::New(env, false);
  }

  return Napi::Boolean::New(env, true);
}

// SDK State Getters
Napi::Value iRacingSdkNode::IsRunning(const Napi::CallbackInfo &info)
{
  bool result = irsdk_isConnected();
  return Napi::Boolean::New(info.Env(), result);
}

Napi::Value iRacingSdkNode::GetSessionVersionNum(const Napi::CallbackInfo &info)
{
  int sessVer = irsdk_getSessionInfoStrUpdate();
  return Napi::Number::New(info.Env(), sessVer);
}

Napi::Value iRacingSdkNode::GetSessionData(const Napi::CallbackInfo &info)
{
  int latestUpdate = irsdk_getSessionInfoStrUpdate();
  if (this->_lastSessionCt != latestUpdate) {
    printf("Session data has been updated (prev: %d, new: %d)\n", this->_lastSessionCt, latestUpdate);
    this->_lastSessionCt = latestUpdate;
    this->_sessionData = irsdk_getSessionInfoStr();
  }
  const char *session = this->_sessionData;
  if (session == NULL) {
    return Napi::String::New(info.Env(), "");
  }
  return Napi::String::New(info.Env(), session);
}

Napi::Value iRacingSdkNode::GetTelemetryVar(const Napi::CallbackInfo &info)
{
  Napi::Env env = info.Env();

  int varIndex;
  if (info.Length() <= 0) {
    varIndex = 0;
  } else if (!info[0].IsNumber()) {
    if (info[0].IsString()) {
      const char *name = info[0].As<Napi::String>().Utf8Value().c_str();
      return this->GetTelemetryVar(env, name);
    }
    varIndex = 0;
  }

  return this->GetTelemetryVarByIndex(env, varIndex);
}

Napi::Value iRacingSdkNode::GetTelemetryData(const Napi::CallbackInfo &info)
{
  const irsdk_header* header = irsdk_getHeader();
  auto env = info.Env();
  auto telemVars = Napi::Object::New(env);
  
  int count = header->numVars;
  for (int i = 0; i < count; i++) {
    auto telemVariable = this->GetTelemetryVarByIndex(env, i);
    if (telemVariable.IsObject() && telemVariable.Has("name")) {
      telemVars.Set(telemVariable.Get("name"), telemVariable);
    }
  }

  return telemVars;
}

// Helpers
Napi::Value iRacingSdkNode::__GetTelemetryTypes(const Napi::CallbackInfo &info)
{
  auto env = info.Env();
  auto result = Napi::Object::New(env);

  const int count = irsdk_getHeader()->numVars;
  const irsdk_varHeader *varHeader;
  for (int i = 0; i < count; i++) {
    varHeader = irsdk_getVarHeaderEntry(i);
    result.Set(varHeader->name, Napi::Number::New(env, varHeader->type));
  }

  return result;
}


// ---------------------------
// Helper functions
// ---------------------------
bool iRacingSdkNode::GetTelemetryBool(int entry, int index)
{
  const irsdk_varHeader *headerVar = irsdk_getVarHeaderEntry(entry);
  return *(reinterpret_cast<bool const *>(_data + headerVar->offset) + index);
}

int iRacingSdkNode::GetTelemetryInt(int entry, int index)
{
  // Each int is 4 bytes
  const irsdk_varHeader *headerVar = irsdk_getVarHeaderEntry(entry);
  return *(reinterpret_cast<int const *>(_data + headerVar->offset) + index * 4);
}

float iRacingSdkNode::GetTelemetryFloat(int entry, int index)
{
  // Each float is 4 bytes
  const irsdk_varHeader *headerVar = irsdk_getVarHeaderEntry(entry);
  return *(reinterpret_cast<float const *>(_data + headerVar->offset) + index * 4);
}

double iRacingSdkNode::GetTelemetryDouble(int entry, int index)
{
  // Each double is 8 bytes
  const irsdk_varHeader *headerVar = irsdk_getVarHeaderEntry(entry);
  return *(reinterpret_cast<double const *>(_data + headerVar->offset) + index * 8);
}

Napi::Object iRacingSdkNode::GetTelemetryVarByIndex(const Napi::Env env, int index)
{
  auto headerVar = irsdk_getVarHeaderEntry(index);
  auto telemVar = Napi::Object::New(env);

  // Create entry object
  telemVar.Set("countAsTime", headerVar->countAsTime);
  telemVar.Set("length", headerVar->count);
  telemVar.Set("name", headerVar->name);
  telemVar.Set("description", headerVar->desc);
  telemVar.Set("unit", headerVar->unit);
  telemVar.Set("varType", headerVar->type);

  int dataSize = headerVar->count * irsdk_VarTypeBytes[headerVar->type];
  auto entryVal = Napi::ArrayBuffer::New(env, dataSize);
  memcpy(entryVal.Data(), this->_data + headerVar->offset, dataSize);

  telemVar.Set("value", entryVal);
  return telemVar;
}

Napi::Object iRacingSdkNode::GetTelemetryVar(const Napi::Env env, const char *varName)
{
  int varIndex = irsdk_varNameToIndex(varName);
  return this->GetTelemetryVarByIndex(env, varIndex);
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports)
{
  iRacingSdkNode::Init(env, exports);
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll);
