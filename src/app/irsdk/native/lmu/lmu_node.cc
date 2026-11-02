#include "lmu_node.h"
#include <algorithm>
#include <cmath>
#include <cstring>

namespace
{
const wchar_t *LMU_SHARED_MEMORY_FILE = L"LMU_Data";

std::string ReadCString(const char *ptr, size_t maxLen)
{
  size_t len = 0;
  while (len < maxLen && ptr[len] != '\0')
    ++len;
  return std::string(ptr, len);
}

void SetString(Napi::Object &obj, const char *key, const char *ptr, size_t maxLen)
{
  obj.Set(key, Napi::String::New(obj.Env(), ReadCString(ptr, maxLen).c_str()));
}

void SetVect3(Napi::Object &obj, const char *key, const LMUVect3 &v)
{
  auto arr = Napi::Float64Array::New(obj.Env(), 3);
  arr[0] = v.x;
  arr[1] = v.y;
  arr[2] = v.z;
  obj.Set(key, arr);
}
} // namespace

Napi::Object LmuSdkNode::Init(Napi::Env env, Napi::Object exports)
{
  Napi::Function func = DefineClass(env, "LmuSdkNode", {
    InstanceMethod("start", &LmuSdkNode::Start),
    InstanceMethod("stop", &LmuSdkNode::Stop),
    InstanceMethod("isRunning", &LmuSdkNode::IsRunning),
    InstanceMethod("read", &LmuSdkNode::Read),
    InstanceMethod("readSession", &LmuSdkNode::ReadSession),
  });

  Napi::FunctionReference *constructor = new Napi::FunctionReference();
  *constructor = Napi::Persistent(func);
  env.SetInstanceData(constructor);

  exports.Set("LmuSdkNode", func);
  return exports;
}

LmuSdkNode::LmuSdkNode(const Napi::CallbackInfo &info)
  : Napi::ObjectWrap<LmuSdkNode>(info)
  , _hMap(NULL)
  , _view(NULL)
  , _mapped(NULL)
  , _snapshot{}
  , _hasSnapshot(false)
{
}

LmuSdkNode::~LmuSdkNode()
{
  Unmap();
}

Napi::Value LmuSdkNode::Start(const Napi::CallbackInfo &info)
{
  auto env = info.Env();
  if (IsLive())
    return Napi::Boolean::New(env, true);

  Unmap();

  _hMap = OpenFileMappingW(FILE_MAP_READ, FALSE, LMU_SHARED_MEMORY_FILE);
  if (_hMap == NULL)
    return Napi::Boolean::New(env, false);

  _view = static_cast<uint8_t *>(MapViewOfFile(_hMap, FILE_MAP_READ, 0, 0, 0));
  if (_view == NULL)
  {
    CloseHandle(_hMap);
    _hMap = NULL;
    return Napi::Boolean::New(env, false);
  }

  MEMORY_BASIC_INFORMATION region{};
  if (VirtualQuery(_view, &region, sizeof(region)) == 0 ||
      region.RegionSize < sizeof(LMUObjectOut))
  {
    Unmap();
    return Napi::Boolean::New(env, false);
  }

  _mapped = reinterpret_cast<const LMUObjectOut *>(_view);
  CaptureSnapshot();
  _classIds.clear();
  return Napi::Boolean::New(env, true);
}

void LmuSdkNode::Unmap()
{
  _mapped = NULL;
  _hasSnapshot = false;
  if (_view != NULL)
  {
    UnmapViewOfFile(_view);
    _view = NULL;
  }
  if (_hMap != NULL)
  {
    CloseHandle(_hMap);
    _hMap = NULL;
  }
  _classIds.clear();
}

Napi::Value LmuSdkNode::Stop(const Napi::CallbackInfo &info)
{
  Unmap();
  return Napi::Boolean::New(info.Env(), true);
}

Napi::Value LmuSdkNode::IsRunning(const Napi::CallbackInfo &info)
{
  CaptureSnapshot();
  return Napi::Boolean::New(info.Env(), IsLive());
}

bool LmuSdkNode::IsLive() const
{
  if (!_hasSnapshot || _snapshot.generic.gameVersion <= 0)
    return false;

  const auto window = reinterpret_cast<HWND>(
      static_cast<uintptr_t>(_snapshot.generic.appInfo.mAppWindow));
  return window != NULL && ::IsWindow(window);
}

bool LmuSdkNode::CaptureSnapshot()
{
  if (_mapped == NULL)
    return false;

  for (int attempt = 0; attempt < 4; ++attempt)
  {
    const LMUSnapshotState before = {
      _mapped->generic.events.SME_UPDATE_SCORING,
      _mapped->generic.events.SME_UPDATE_TELEMETRY,
      _mapped->scoring.scoringInfo.mNumVehicles,
      _mapped->telemetry.activeVehicles,
    };
    MemoryBarrier();
    LMUObjectOut candidate;
    std::memcpy(&candidate, _mapped, sizeof(candidate));
    MemoryBarrier();
    const LMUSnapshotState snapshot = {
      candidate.generic.events.SME_UPDATE_SCORING,
      candidate.generic.events.SME_UPDATE_TELEMETRY,
      candidate.scoring.scoringInfo.mNumVehicles,
      candidate.telemetry.activeVehicles,
    };
    const LMUSnapshotState after = {
      _mapped->generic.events.SME_UPDATE_SCORING,
      _mapped->generic.events.SME_UPDATE_TELEMETRY,
      _mapped->scoring.scoringInfo.mNumVehicles,
      _mapped->telemetry.activeVehicles,
    };

    if (!IsCoherentLmuSnapshot(before, snapshot, after))
      continue;

    _snapshot = candidate;
    _hasSnapshot = true;
    return true;
  }

  return false;
}

int LmuSdkNode::GetClassId(const char *className) const
{
  std::string name(className);
  auto it = _classIds.find(name);
  if (it != _classIds.end())
    return it->second;
  int id = static_cast<int>(_classIds.size());
  _classIds[name] = id;
  return id;
}

int LmuSdkNode::VehicleCount() const
{
  return std::clamp<int>(
      _snapshot.scoring.scoringInfo.mNumVehicles, 0, LMU_MAX_VEHICLES);
}

const LMUVehicleTelemetry *LmuSdkNode::GetPlayerTelemetry() const
{
  const auto &telem = _snapshot.telemetry;
  if (!telem.playerHasVehicle)
    return NULL;
  uint8_t idx = telem.playerVehicleIdx;
  if (idx >= LMU_MAX_VEHICLES)
    return NULL;
  return &telem.telemInfo[idx];
}

const LMUVehicleTelemetry *LmuSdkNode::GetVehicleTelemetryById(int id) const
{
  const int count = std::clamp<int>(
      _snapshot.telemetry.activeVehicles, 0, LMU_MAX_VEHICLES);
  for (int index = 0; index < count; ++index)
  {
    if (_snapshot.telemetry.telemInfo[index].mID == id)
      return &_snapshot.telemetry.telemInfo[index];
  }
  return NULL;
}

void LmuSdkNode::FillVehicleArrays(Napi::Object &out) const
{
  auto env = out.Env();
  const auto &scoring = _snapshot.scoring;
  const int count = VehicleCount();

  // Build arrays indexed by the vehicle's slot id (mID), so a given CarIdx
  // maps to the same slot every frame. 104 slots matches iRacing's fixed
  // 64-slot assumption closely enough: consumers iterate arr.length.
  int cap = 0;
  for (int i = 0; i < count; ++i)
  {
    const int id = scoring.vehScoringInfo[i].mID;
    if (id >= 0 && id < LMU_MAX_VEHICLES && id + 1 > cap)
      cap = id + 1;
  }

  auto ids = Napi::Int32Array::New(env, cap);
  auto isPlayer = Napi::Uint8Array::New(env, cap);
  auto places = Napi::Int32Array::New(env, cap);
  auto lapDistPct = Napi::Float64Array::New(env, cap);
  if (cap > 0)
    std::fill(lapDistPct.Data(), lapDistPct.Data() + cap, -1.0);
  auto totalLaps = Napi::Int32Array::New(env, cap);
  auto bestLapTime = Napi::Float64Array::New(env, cap);
  auto lastLapTime = Napi::Float64Array::New(env, cap);
  auto inPits = Napi::Uint8Array::New(env, cap);
  auto inGarageStall = Napi::Uint8Array::New(env, cap);
  auto pitState = Napi::Uint8Array::New(env, cap);
  auto classId = Napi::Int32Array::New(env, cap);
  auto timeIntoLap = Napi::Float64Array::New(env, cap);
  auto estimatedLapTime = Napi::Float64Array::New(env, cap);
  auto timeBehindNext = Napi::Float64Array::New(env, cap);
  auto timeBehindLeader = Napi::Float64Array::New(env, cap);
  auto lapsBehindNext = Napi::Int32Array::New(env, cap);
  auto lapsBehindLeader = Napi::Int32Array::New(env, cap);
  auto qualification = Napi::Float64Array::New(env, cap);
  auto finishStatus = Napi::Int32Array::New(env, cap);
  auto individualPhase = Napi::Int32Array::New(env, cap);
  auto lapStartET = Napi::Float64Array::New(env, cap);
  auto sector = Napi::Int32Array::New(env, cap);
  auto flag = Napi::Uint8Array::New(env, cap);
  auto underYellow = Napi::Uint8Array::New(env, cap);
  auto bestSector1 = Napi::Float64Array::New(env, cap);
  auto bestSector2 = Napi::Float64Array::New(env, cap);
  auto lastSector1 = Napi::Float64Array::New(env, cap);
  auto lastSector2 = Napi::Float64Array::New(env, cap);
  auto curSector1 = Napi::Float64Array::New(env, cap);
  auto curSector2 = Napi::Float64Array::New(env, cap);
  auto telemetryAvailable = Napi::Uint8Array::New(env, cap);
  auto posX = Napi::Float64Array::New(env, cap);
  auto posZ = Napi::Float64Array::New(env, cap);
  auto oriX = Napi::Float64Array::New(env, cap);
  auto oriZ = Napi::Float64Array::New(env, cap);

  for (int i = 0; i < count; ++i)
  {
    const auto &v = scoring.vehScoringInfo[i];
    const int id = v.mID;
    if (id < 0 || id >= LMU_MAX_VEHICLES)
      continue;
    ids[id] = v.mID;
    isPlayer[id] = v.mIsPlayer ? 1 : 0;
    places[id] = v.mPlace;
    lapDistPct[id] = scoring.scoringInfo.mLapDist > 0.0
        ? std::clamp(v.mLapDist / scoring.scoringInfo.mLapDist, 0.0, 1.0)
        : 0.0;
    totalLaps[id] = v.mTotalLaps;
    bestLapTime[id] = v.mBestLapTime;
    lastLapTime[id] = v.mLastLapTime;
    inPits[id] = v.mInPits ? 1 : 0;
    inGarageStall[id] = v.mInGarageStall ? 1 : 0;
    pitState[id] = v.mPitState;
    classId[id] = GetClassId(v.mVehicleClass);
    timeIntoLap[id] = v.mTimeIntoLap;
    estimatedLapTime[id] = v.mEstimatedLapTime;
    timeBehindNext[id] = v.mTimeBehindNext;
    timeBehindLeader[id] = v.mTimeBehindLeader;
    lapsBehindNext[id] = v.mLapsBehindNext;
    lapsBehindLeader[id] = v.mLapsBehindLeader;
    qualification[id] = v.mQualification;
    finishStatus[id] = v.mFinishStatus;
    individualPhase[id] = v.mIndividualPhase;
    lapStartET[id] = v.mLapStartET;
    sector[id] = v.mSector;
    flag[id] = v.mFlag;
    underYellow[id] = v.mUnderYellow ? 1 : 0;
    bestSector1[id] = v.mBestSector1;
    bestSector2[id] = v.mBestSector2;
    lastSector1[id] = v.mLastSector1;
    lastSector2[id] = v.mLastSector2;
    curSector1[id] = v.mCurSector1;
    curSector2[id] = v.mCurSector2;
    const auto *telemetryVehicle = GetVehicleTelemetryById(id);
    if (telemetryVehicle != NULL)
    {
      telemetryAvailable[id] = 1;
      posX[id] = telemetryVehicle->mPos.x;
      posZ[id] = telemetryVehicle->mPos.z;
      oriX[id] = telemetryVehicle->mOri[2].x;
      oriZ[id] = telemetryVehicle->mOri[2].z;
    }
  }

  out.Set("vehIds", ids);
  out.Set("vehIsPlayer", isPlayer);
  out.Set("vehPlaces", places);
  out.Set("vehLapDistPct", lapDistPct);
  out.Set("vehTotalLaps", totalLaps);
  out.Set("vehBestLapTime", bestLapTime);
  out.Set("vehLastLapTime", lastLapTime);
  out.Set("vehInPits", inPits);
  out.Set("vehInGarageStall", inGarageStall);
  out.Set("vehPitState", pitState);
  out.Set("vehClass", classId);
  out.Set("vehTimeIntoLap", timeIntoLap);
  out.Set("vehEstimatedLapTime", estimatedLapTime);
  out.Set("vehTimeBehindNext", timeBehindNext);
  out.Set("vehTimeBehindLeader", timeBehindLeader);
  out.Set("vehLapsBehindNext", lapsBehindNext);
  out.Set("vehLapsBehindLeader", lapsBehindLeader);
  out.Set("vehQualification", qualification);
  out.Set("vehFinishStatus", finishStatus);
  out.Set("vehIndividualPhase", individualPhase);
  out.Set("vehLapStartET", lapStartET);
  out.Set("vehSector", sector);
  out.Set("vehFlag", flag);
  out.Set("vehUnderYellow", underYellow);
  out.Set("vehBestSector1", bestSector1);
  out.Set("vehBestSector2", bestSector2);
  out.Set("vehLastSector1", lastSector1);
  out.Set("vehLastSector2", lastSector2);
  out.Set("vehCurSector1", curSector1);
  out.Set("vehCurSector2", curSector2);
  out.Set("vehTelemetryAvailable", telemetryAvailable);
  out.Set("vehPosX", posX);
  out.Set("vehPosZ", posZ);
  out.Set("vehOriX", oriX);
  out.Set("vehOriZ", oriZ);
}

Napi::Value LmuSdkNode::Read(const Napi::CallbackInfo &info)
{
  auto env = info.Env();
  auto out = Napi::Object::New(env);
  const bool captured = CaptureSnapshot();
  out.Set("running", captured && IsLive());

  if (!captured || !IsLive())
    return out;

  const auto &scoring = _snapshot.scoring.scoringInfo;

  out.Set("gameVersion", _snapshot.generic.gameVersion);
  SetString(out, "trackName", scoring.mTrackName, sizeof(scoring.mTrackName));
  SetString(out, "playerName", scoring.mPlayerName, sizeof(scoring.mPlayerName));
  SetString(out, "serverName", scoring.mServerName, sizeof(scoring.mServerName));
  out.Set("session", scoring.mSession);
  out.Set("currentET", scoring.mCurrentET);
  out.Set("endET", scoring.mEndET);
  out.Set("maxLaps", scoring.mMaxLaps);
  out.Set("lapDist", scoring.mLapDist);
  out.Set("numVehicles", scoring.mNumVehicles);
  out.Set("gamePhase", scoring.mGamePhase);
  out.Set("yellowFlagState", scoring.mYellowFlagState);
  auto sectorFlags = Napi::Uint8Array::New(env, 3);
  for (size_t i = 0; i < 3; ++i)
    sectorFlags[i] = scoring.mSectorFlag[i];
  out.Set("sectorFlags", sectorFlags);
  out.Set("inRealtime", scoring.mInRealtime);
  out.Set("gameMode", scoring.mGameMode);
  out.Set("isFixedSetup", scoring.mIsFixedSetup);
  out.Set("maxPlayers", scoring.mMaxPlayers);
  out.Set("sessionTimeRemaining", scoring.mSessionTimeRemaining);
  out.Set("timeOfDay", scoring.mTimeOfDay);
  out.Set("trackGripLevel", scoring.mTrackGripLevel);
  out.Set("cloudCoverage", scoring.mCloudCoverage);
  out.Set("raining", scoring.mRaining);
  out.Set("darkCloud", scoring.mDarkCloud);
  out.Set("ambientTemp", scoring.mAmbientTemp);
  out.Set("trackTemp", scoring.mTrackTemp);
  out.Set("minPathWetness", scoring.mMinPathWetness);
  out.Set("maxPathWetness", scoring.mMaxPathWetness);
  out.Set("avgPathWetness", scoring.mAvgPathWetness);
  SetVect3(out, "wind", scoring.mWind);

  const auto *player = GetPlayerTelemetry();
  out.Set(
      "playerVehicleIdx",
      player != NULL ? player->mID : -1);
  out.Set("playerHasVehicle", _snapshot.telemetry.playerHasVehicle);
  out.Set("activeVehicles", _snapshot.telemetry.activeVehicles);

  if (player != NULL)
  {
    out.Set("gear", player->mGear);
    out.Set("engineRPM", player->mEngineRPM);
    out.Set("engineWaterTemp", player->mEngineWaterTemp);
    out.Set("engineOilTemp", player->mEngineOilTemp);
    out.Set("clutchRPM", player->mClutchRPM);
    out.Set("unfilteredThrottle", player->mUnfilteredThrottle);
    out.Set("unfilteredBrake", player->mUnfilteredBrake);
    out.Set("unfilteredSteering", player->mUnfilteredSteering);
    out.Set("unfilteredClutch", player->mUnfilteredClutch);
    out.Set("filteredThrottle", player->mFilteredThrottle);
    out.Set("filteredBrake", player->mFilteredBrake);
    out.Set("filteredSteering", player->mFilteredSteering);
    out.Set("filteredClutch", player->mFilteredClutch);
    out.Set("steeringShaftTorque", player->mSteeringShaftTorque);
    out.Set("fuel", player->mFuel);
    out.Set("fuelCapacity", player->mFuelCapacity);
    out.Set("engineMaxRPM", player->mEngineMaxRPM);
    out.Set("rearBrakeBias", player->mRearBrakeBias);
    out.Set("lapNumber", player->mLapNumber);
    out.Set("elapsedTime", player->mElapsedTime);
    out.Set("lapStartET", player->mLapStartET);
    out.Set("currentSector", player->mCurrentSector);
    out.Set("lapInvalidated", player->mLapInvalidated);
    out.Set("speedLimiterActive", player->mSpeedLimiterActive);
    out.Set("speedLimiter", player->mSpeedLimiter);
    out.Set("absActive", player->mABSActive);
    out.Set("tcActive", player->mTCActive);
    out.Set("ignitionStarter", player->mIgnitionStarter);
    out.Set("maxGears", player->mMaxGears);
    out.Set("visualSteeringWheelRange", player->mVisualSteeringWheelRange);
    out.Set("deltaBest", player->mDeltaBest);
    out.Set("batteryChargeFraction", player->mBatteryChargeFraction);
    out.Set("turboBoostPressure", player->mTurboBoostPressure);
    SetString(out, "frontTireCompoundName", player->mFrontTireCompoundName, sizeof(player->mFrontTireCompoundName));
    SetString(out, "vehicleName", player->mVehicleName, sizeof(player->mVehicleName));
    SetVect3(out, "localAccel", player->mLocalAccel);

    auto tyreTemperature = Napi::Float64Array::New(env, 4);
    auto tyrePressure = Napi::Float64Array::New(env, 4);
    auto tyreWear = Napi::Float64Array::New(env, 4);
    auto brakePressure = Napi::Float64Array::New(env, 4);
    auto suspensionDeflection = Napi::Float64Array::New(env, 4);
    for (size_t i = 0; i < 4; ++i)
    {
      const auto &wheel = player->mWheels[i];
      tyreTemperature[i] =
          (wheel.mTemperature[0] + wheel.mTemperature[1] + wheel.mTemperature[2]) / 3.0 - 273.15;
      tyrePressure[i] = wheel.mPressure;
      tyreWear[i] = wheel.mWear;
      brakePressure[i] = wheel.mBrakePressure;
      suspensionDeflection[i] = wheel.mSuspensionDeflection;
    }
    out.Set("tyreTemperature", tyreTemperature);
    out.Set("tyrePressure", tyrePressure);
    out.Set("tyreWear", tyreWear);
    out.Set("brakePressure", brakePressure);
    out.Set("suspensionDeflection", suspensionDeflection);

    double vx = player->mLocalVel.x;
    double vy = player->mLocalVel.y;
    double vz = player->mLocalVel.z;
    out.Set("speed", std::sqrt(vx * vx + vy * vy + vz * vz));
    SetVect3(out, "localVel", player->mLocalVel);
    SetVect3(out, "pos", player->mPos);
  }

  FillVehicleArrays(out);
  return out;
}

Napi::Value LmuSdkNode::ReadSession(const Napi::CallbackInfo &info)
{
  auto env = info.Env();
  Napi::Value base = Read(info);
  if (!base.IsObject())
    return Napi::Object::New(env);

  auto obj = base.As<Napi::Object>();
  if (!obj.Get("running").ToBoolean())
    return obj;

  const auto &scoring = _snapshot.scoring;
  const int count = VehicleCount();

  auto classes = Napi::Array::New(env, static_cast<size_t>(_classIds.size()));
  size_t ci = 0;
  for (const auto &entry : _classIds)
  {
    auto cls = Napi::Object::New(env);
    cls.Set("id", entry.second);
    cls.Set("name", entry.first);
    classes.Set(ci++, cls);
  }
  obj.Set("classes", classes);

  auto drivers = Napi::Array::New(env, count);
  for (int i = 0; i < count; ++i)
  {
    const auto &v = scoring.vehScoringInfo[i];
    auto d = Napi::Object::New(env);
    d.Set("id", v.mID);
    d.Set("isPlayer", v.mIsPlayer);
    d.Set("control", v.mControl);
    SetString(d, "name", v.mDriverName, sizeof(v.mDriverName));
    SetString(d, "vehicleName", v.mVehicleName, sizeof(v.mVehicleName));
    const auto *telemetryVehicle = GetVehicleTelemetryById(v.mID);
    if (telemetryVehicle != NULL)
      SetString(d, "vehicleModel", telemetryVehicle->mVehicleModel, sizeof(telemetryVehicle->mVehicleModel));
    SetString(d, "className", v.mVehicleClass, sizeof(v.mVehicleClass));
    SetString(d, "vehFilename", v.mVehFilename, sizeof(v.mVehFilename));
    d.Set("classId", GetClassId(v.mVehicleClass));
    d.Set("totalLaps", v.mTotalLaps);
    d.Set("sector", v.mSector);
    d.Set("finishStatus", v.mFinishStatus);
    d.Set("lapDist", v.mLapDist);
    d.Set("bestSector1", v.mBestSector1);
    d.Set("bestSector2", v.mBestSector2);
    d.Set("bestLapTime", v.mBestLapTime);
    d.Set("lastSector1", v.mLastSector1);
    d.Set("lastSector2", v.mLastSector2);
    d.Set("lastLapTime", v.mLastLapTime);
    d.Set("numPitstops", v.mNumPitstops);
    d.Set("numPenalties", v.mNumPenalties);
    d.Set("inPits", v.mInPits);
    d.Set("place", v.mPlace);
    d.Set("timeBehindNext", v.mTimeBehindNext);
    d.Set("lapsBehindNext", v.mLapsBehindNext);
    d.Set("timeBehindLeader", v.mTimeBehindLeader);
    d.Set("lapsBehindLeader", v.mLapsBehindLeader);
    d.Set("qualification", v.mQualification);
    d.Set("timeIntoLap", v.mTimeIntoLap);
    d.Set("estimatedLapTime", v.mEstimatedLapTime);
    d.Set("pitState", v.mPitState);
    d.Set("individualPhase", v.mIndividualPhase);
    d.Set("underYellow", v.mUnderYellow);
    d.Set("countLapFlag", v.mCountLapFlag);
    d.Set("inGarageStall", v.mInGarageStall);
    d.Set("pitLapDist", v.mPitLapDist);
    d.Set("steamId", static_cast<double>(v.mSteamID));
    d.Set("fuelFraction", v.mFuelFraction);
    SetVect3(d, "pos", v.mPos);
    SetVect3(d, "localVel", v.mLocalVel);
    drivers.Set(i, d);
  }
  obj.Set("drivers", drivers);
  return obj;
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports)
{
  LmuSdkNode::Init(env, exports);
  return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, InitAll);