#include "./irsdk_node.h"
#include "./lib/yaml_parser.h"

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
  case irsdk_BroadcastReplaySetPlayPosition:
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

// Helper function to convert Windows-1252 to UTF-8
std::string ConvertToUTF8(const char* input) {
    if (!input) return "";
    
    std::string result;
    result.reserve(strlen(input) * 2); // Reserve space for potential UTF-8 expansion
    
    for (const char* p = input; *p; ++p) {
        unsigned char c = *p;
        if (c < 0x80) {
            // ASCII character
            result += c;
        } else {
            // Windows-1252 to UTF-8 conversion
            switch (c) {
                case 0x80: result += "\xE2\x82\xAC"; break; // €
                case 0x82: result += "\xE2\x80\x9A"; break; // ‚
                case 0x83: result += "\xC6\x92"; break;     // ƒ
                case 0x84: result += "\xE2\x80\x9E"; break; // „
                case 0x85: result += "\xE2\x80\xA6"; break; // …
                case 0x86: result += "\xE2\x80\xA0"; break; // †
                case 0x87: result += "\xE2\x80\xA1"; break; // ‡
                case 0x88: result += "\xCB\x86"; break;     // ˆ
                case 0x89: result += "\xE2\x80\xB0"; break; // ‰
                case 0x8A: result += "\xC5\xA0"; break;     // Š
                case 0x8B: result += "\xE2\x80\xB9"; break; // ‹
                case 0x8C: result += "\xC5\x92"; break;     // Œ
                case 0x8E: result += "\xC5\xBD"; break;     // Ž
                case 0x91: result += "\xE2\x80\x98"; break; // '
                case 0x92: result += "\xE2\x80\x99"; break; // '
                case 0x93: result += "\xE2\x80\x9C"; break; // "
                case 0x94: result += "\xE2\x80\x9D"; break; // "
                case 0x95: result += "\xE2\x80\xA2"; break; // •
                case 0x96: result += "\xE2\x80\x93"; break; // –
                case 0x97: result += "\xE2\x80\x94"; break; // —
                case 0x98: result += "\xCB\x9C"; break;     // ˜
                case 0x99: result += "\xE2\x84\xA2"; break; // ™
                case 0x9A: result += "\xC5\xA1"; break;     // š
                case 0x9B: result += "\xE2\x80\xBA"; break; // ›
                case 0x9C: result += "\xC5\x93"; break;     // œ
                case 0x9E: result += "\xC5\xBE"; break;     // ž
                case 0x9F: result += "\xC5\xB8"; break;     // Ÿ
                case 0xA0: result += "\xC2\xA0"; break;     //  
                case 0xA1: result += "\xC2\xA1"; break;     // ¡
                case 0xA2: result += "\xC2\xA2"; break;     // ¢
                case 0xA3: result += "\xC2\xA3"; break;     // £
                case 0xA4: result += "\xC2\xA4"; break;     // ¤
                case 0xA5: result += "\xC2\xA5"; break;     // ¥
                case 0xA6: result += "\xC2\xA6"; break;     // ¦
                case 0xA7: result += "\xC2\xA7"; break;     // §
                case 0xA8: result += "\xC2\xA8"; break;     // ¨
                case 0xA9: result += "\xC2\xA9"; break;     // ©
                case 0xAA: result += "\xC2\xAA"; break;     // ª
                case 0xAB: result += "\xC2\xAB"; break;     // «
                case 0xAC: result += "\xC2\xAC"; break;     // ¬
                case 0xAD: result += "\xC2\xAD"; break;     // ­
                case 0xAE: result += "\xC2\xAE"; break;     // ®
                case 0xAF: result += "\xC2\xAF"; break;     // ¯
                case 0xB0: result += "\xC2\xB0"; break;     // °
                case 0xB1: result += "\xC2\xB1"; break;     // ±
                case 0xB2: result += "\xC2\xB2"; break;     // ²
                case 0xB3: result += "\xC2\xB3"; break;     // ³
                case 0xB4: result += "\xC2\xB4"; break;     // ´
                case 0xB5: result += "\xC2\xB5"; break;     // µ
                case 0xB6: result += "\xC2\xB6"; break;     // ¶
                case 0xB7: result += "\xC2\xB7"; break;     // ·
                case 0xB8: result += "\xC2\xB8"; break;     // ¸
                case 0xB9: result += "\xC2\xB9"; break;     // ¹
                case 0xBA: result += "\xC2\xBA"; break;     // º
                case 0xBB: result += "\xC2\xBB"; break;     // »
                case 0xBC: result += "\xC2\xBC"; break;     // ¼
                case 0xBD: result += "\xC2\xBD"; break;     // ½
                case 0xBE: result += "\xC2\xBE"; break;     // ¾
                case 0xBF: result += "\xC2\xBF"; break;     // ¿
                case 0xC0: result += "\xC3\x80"; break;     // À
                case 0xC1: result += "\xC3\x81"; break;     // Á
                case 0xC2: result += "\xC3\x82"; break;     // Â
                case 0xC3: result += "\xC3\x83"; break;     // Ã
                case 0xC4: result += "\xC3\x84"; break;     // Ä
                case 0xC5: result += "\xC3\x85"; break;     // Å
                case 0xC6: result += "\xC3\x86"; break;     // Æ
                case 0xC7: result += "\xC3\x87"; break;     // Ç
                case 0xC8: result += "\xC3\x88"; break;     // È
                case 0xC9: result += "\xC3\x89"; break;     // É
                case 0xCA: result += "\xC3\x8A"; break;     // Ê
                case 0xCB: result += "\xC3\x8B"; break;     // Ë
                case 0xCC: result += "\xC3\x8C"; break;     // Ì
                case 0xCD: result += "\xC3\x8D"; break;     // Í
                case 0xCE: result += "\xC3\x8E"; break;     // Î
                case 0xCF: result += "\xC3\x8F"; break;     // Ï
                case 0xD0: result += "\xC3\x90"; break;     // Ð
                case 0xD1: result += "\xC3\x91"; break;     // Ñ
                case 0xD2: result += "\xC3\x92"; break;     // Ò
                case 0xD3: result += "\xC3\x93"; break;     // Ó
                case 0xD4: result += "\xC3\x94"; break;     // Ô
                case 0xD5: result += "\xC3\x95"; break;     // Õ
                case 0xD6: result += "\xC3\x96"; break;     // Ö
                case 0xD7: result += "\xC3\x97"; break;     // ×
                case 0xD8: result += "\xC3\x98"; break;     // Ø
                case 0xD9: result += "\xC3\x99"; break;     // Ù
                case 0xDA: result += "\xC3\x9A"; break;     // Ú
                case 0xDB: result += "\xC3\x9B"; break;     // Û
                case 0xDC: result += "\xC3\x9C"; break;     // Ü
                case 0xDD: result += "\xC3\x9D"; break;     // Ý
                case 0xDE: result += "\xC3\x9E"; break;     // Þ
                case 0xDF: result += "\xC3\x9F"; break;     // ß
                case 0xE0: result += "\xC3\xA0"; break;     // à
                case 0xE1: result += "\xC3\xA1"; break;     // á
                case 0xE2: result += "\xC3\xA2"; break;     // â
                case 0xE3: result += "\xC3\xA3"; break;     // ã
                case 0xE4: result += "\xC3\xA4"; break;     // ä
                case 0xE5: result += "\xC3\xA5"; break;     // å
                case 0xE6: result += "\xC3\xA6"; break;     // æ
                case 0xE7: result += "\xC3\xA7"; break;     // ç
                case 0xE8: result += "\xC3\xA8"; break;     // è
                case 0xE9: result += "\xC3\xA9"; break;     // é
                case 0xEA: result += "\xC3\xAA"; break;     // ê
                case 0xEB: result += "\xC3\xAB"; break;     // ë
                case 0xEC: result += "\xC3\xAC"; break;     // ì
                case 0xED: result += "\xC3\xAD"; break;     // í
                case 0xEE: result += "\xC3\xAE"; break;     // î
                case 0xEF: result += "\xC3\xAF"; break;     // ï
                case 0xF0: result += "\xC3\xB0"; break;     // ð
                case 0xF1: result += "\xC3\xB1"; break;     // ñ
                case 0xF2: result += "\xC3\xB2"; break;     // ò
                case 0xF3: result += "\xC3\xB3"; break;     // ó
                case 0xF4: result += "\xC3\xB4"; break;     // ô
                case 0xF5: result += "\xC3\xB5"; break;     // õ
                case 0xF6: result += "\xC3\xB6"; break;     // ö
                case 0xF7: result += "\xC3\xB7"; break;     // ÷
                case 0xF8: result += "\xC3\xB8"; break;     // ø
                case 0xF9: result += "\xC3\xB9"; break;     // ù
                case 0xFA: result += "\xC3\xBA"; break;     // ú
                case 0xFB: result += "\xC3\xBB"; break;     // û
                case 0xFC: result += "\xC3\xBC"; break;     // ü
                case 0xFD: result += "\xC3\xBD"; break;     // ý
                case 0xFE: result += "\xC3\xBE"; break;     // þ
                case 0xFF: result += "\xC3\xBF"; break;     // ÿ
                default: result += c; break;
            }
        }
    }
    return result;
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

  // Convert Windows-1252 to UTF-8
  std::string utf8Session = ConvertToUTF8(session);
  return Napi::String::New(info.Env(), utf8Session.c_str());
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
