#ifndef LMU_STRUCT_H
#define LMU_STRUCT_H

// Le Mans Ultimate shared-memory layout (packed, 4-byte alignment).
//
// Ported from TinyPedal's pyLMUSharedMemory/lmu_data.py (ctypes, _pack_=4).
// Verified against Python 3.14.3 ctypes sizes. Do not reorder fields or drop
// the pack pragma; static_asserts below pin every struct to its verified size.

#include <cstddef>
#include <cstdint>

#pragma pack(push, 4)

struct LMUVect3 {
  double x;
  double y;
  double z;
};

struct LMUWheel {
  double mSuspensionDeflection;
  double mRideHeight;
  double mSuspForce;
  double mBrakeTemp;
  double mBrakePressure;
  double mRotation;
  double mLateralPatchVel;
  double mLongitudinalPatchVel;
  double mLateralGroundVel;
  double mLongitudinalGroundVel;
  double mCamber;
  double mLateralForce;
  double mLongitudinalForce;
  double mTireLoad;
  double mGripFract;
  double mPressure;
  double mTemperature[3];
  double mWear;
  char mTerrainName[16];
  uint8_t mSurfaceType;
  bool mFlat;
  bool mDetached;
  uint8_t mStaticUndeflectedRadius;
  double mVerticalTireDeflection;
  double mWheelYLocation;
  double mToe;
  double mTireCarcassTemperature;
  double mTireInnerLayerTemperature[3];
  float mOptimalTemp;
  uint8_t mCompoundIndex;
  uint8_t mCompoundType;
  uint8_t mExpansion[18];
};

struct LMUVehicleTelemetry {
  int32_t mID;
  double mDeltaTime;
  double mElapsedTime;
  int32_t mLapNumber;
  double mLapStartET;
  char mVehicleName[64];
  char mTrackName[64];
  LMUVect3 mPos;
  LMUVect3 mLocalVel;
  LMUVect3 mLocalAccel;
  LMUVect3 mOri[3];
  LMUVect3 mLocalRot;
  LMUVect3 mLocalRotAccel;
  int32_t mGear;
  double mEngineRPM;
  double mEngineWaterTemp;
  double mEngineOilTemp;
  double mClutchRPM;
  double mUnfilteredThrottle;
  double mUnfilteredBrake;
  double mUnfilteredSteering;
  double mUnfilteredClutch;
  double mFilteredThrottle;
  double mFilteredBrake;
  double mFilteredSteering;
  double mFilteredClutch;
  double mSteeringShaftTorque;
  double mFront3rdDeflection;
  double mRear3rdDeflection;
  double mFrontWingHeight;
  double mFrontRideHeight;
  double mRearRideHeight;
  double mDrag;
  double mFrontDownforce;
  double mRearDownforce;
  double mFuel;
  double mEngineMaxRPM;
  uint8_t mScheduledStops;
  bool mOverheating;
  bool mDetached;
  bool mHeadlights;
  uint8_t mDentSeverity[8];
  double mLastImpactET;
  double mLastImpactMagnitude;
  LMUVect3 mLastImpactPos;
  double mEngineTorque;
  int32_t mCurrentSector;
  uint8_t mSpeedLimiter;
  uint8_t mMaxGears;
  uint8_t mFrontTireCompoundIndex;
  uint8_t mRearTireCompoundIndex;
  double mFuelCapacity;
  uint8_t mFrontFlapActivated;
  uint8_t mRearFlapActivated;
  uint8_t mRearFlapLegalStatus;
  uint8_t mIgnitionStarter;
  char mFrontTireCompoundName[18];
  char mRearTireCompoundName[18];
  uint8_t mSpeedLimiterAvailable;
  uint8_t mAntiStallActivated;
  uint8_t mUnused[2];
  float mVisualSteeringWheelRange;
  double mRearBrakeBias;
  double mTurboBoostPressure;
  float mPhysicsToGraphicsOffset[3];
  float mPhysicalSteeringWheelRange;
  double mDeltaBest;
  double mBatteryChargeFraction;
  double mElectricBoostMotorTorque;
  double mElectricBoostMotorRPM;
  double mElectricBoostMotorTemperature;
  double mElectricBoostWaterTemperature;
  uint8_t mElectricBoostMotorState;
  bool mLapInvalidated;
  bool mABSActive;
  bool mTCActive;
  bool mSpeedLimiterActive;
  uint8_t mWiperState;
  uint8_t mTC;
  uint8_t mTCMax;
  uint8_t mTCSlip;
  uint8_t mTCSlipMax;
  uint8_t mTCCut;
  uint8_t mTCCutMax;
  uint8_t mABS;
  uint8_t mABSMax;
  uint8_t mMotorMap;
  uint8_t mMotorMapMax;
  uint8_t mMigration;
  uint8_t mMigrationMax;
  uint8_t mFrontAntiSway;
  uint8_t mFrontAntiSwayMax;
  uint8_t mRearAntiSway;
  uint8_t mRearAntiSwayMax;
  uint8_t mLiftAndCoastProgress;
  uint8_t mTrackLimitsSteps;
  float mRegen;
  float mStateOfCharge;
  float mVirtualEnergy;
  float mTimeGapCarAhead;
  float mTimeGapCarBehind;
  float mTimeGapPlaceAhead;
  float mTimeGapPlaceBehind;
  char mVehicleModel[30];
  uint8_t mVehicleClass;
  uint8_t mVehicleChampionship;
  uint8_t mExpansion[20];
  LMUWheel mWheels[4];
};

struct LMUVehicleScoring {
  int32_t mID;
  char mDriverName[32];
  char mVehicleName[64];
  int16_t mTotalLaps;
  uint8_t mSector;
  uint8_t mFinishStatus;
  double mLapDist;
  double mPathLateral;
  double mTrackEdge;
  double mBestSector1;
  double mBestSector2;
  double mBestLapTime;
  double mLastSector1;
  double mLastSector2;
  double mLastLapTime;
  double mCurSector1;
  double mCurSector2;
  int16_t mNumPitstops;
  int16_t mNumPenalties;
  bool mIsPlayer;
  uint8_t mControl;
  bool mInPits;
  uint8_t mPlace;
  char mVehicleClass[32];
  double mTimeBehindNext;
  int32_t mLapsBehindNext;
  double mTimeBehindLeader;
  int32_t mLapsBehindLeader;
  double mLapStartET;
  LMUVect3 mPos;
  LMUVect3 mLocalVel;
  LMUVect3 mLocalAccel;
  LMUVect3 mOri[3];
  LMUVect3 mLocalRot;
  LMUVect3 mLocalRotAccel;
  uint8_t mHeadlights;
  uint8_t mPitState;
  uint8_t mServerScored;
  uint8_t mIndividualPhase;
  int32_t mQualification;
  double mTimeIntoLap;
  double mEstimatedLapTime;
  char mPitGroup[24];
  uint8_t mFlag;
  bool mUnderYellow;
  uint8_t mCountLapFlag;
  bool mInGarageStall;
  uint8_t mUpgradePack[16];
  float mPitLapDist;
  float mBestLapSector1;
  float mBestLapSector2;
  uint64_t mSteamID;
  char mVehFilename[32];
  int16_t mAttackMode;
  uint8_t mFuelFraction;
  bool mDRSState;
  uint8_t mExpansion[4];
};

struct LMUScoringInfo {
  char mTrackName[64];
  int32_t mSession;
  double mCurrentET;
  double mEndET;
  int32_t mMaxLaps;
  double mLapDist;
  uint8_t mResultsStreamPointer[8];
  int32_t mNumVehicles;
  uint8_t mGamePhase;
  int8_t mYellowFlagState;
  uint8_t mSectorFlag[3];
  uint8_t mStartLight;
  uint8_t mNumRedLights;
  bool mInRealtime;
  char mPlayerName[32];
  char mPlrFileName[64];
  double mDarkCloud;
  double mRaining;
  double mAmbientTemp;
  double mTrackTemp;
  LMUVect3 mWind;
  double mMinPathWetness;
  double mMaxPathWetness;
  uint8_t mGameMode;
  bool mIsPasswordProtected;
  uint16_t mServerPort;
  uint32_t mServerPublicIP;
  int32_t mMaxPlayers;
  char mServerName[32];
  float mStartET;
  double mAvgPathWetness;
  float mSessionTimeRemaining;
  float mTimeOfDay;
  bool mIsFixedSetup;
  uint8_t mTrackGripLevel;
  uint8_t mCloudCoverage;
  uint8_t mTrackLimitsStepsPerPenalty;
  uint8_t mTrackLimitsStepsPerPoint;
  uint8_t mExpansion[187];
  uint8_t mVehiclePointer[8];
};

struct LMUApplicationState {
  uint64_t mAppWindow;
  uint32_t mWidth;
  uint32_t mHeight;
  uint32_t mRefreshRate;
  uint32_t mWindowed;
  uint8_t mOptionsLocation;
  char mOptionsPage[31];
  uint8_t mExpansion[204];
};

struct LMUEvent {
  uint32_t SME_ENTER;
  uint32_t SME_EXIT;
  uint32_t SME_STARTUP;
  uint32_t SME_SHUTDOWN;
  uint32_t SME_LOAD;
  uint32_t SME_UNLOAD;
  uint32_t SME_START_SESSION;
  uint32_t SME_END_SESSION;
  uint32_t SME_ENTER_REALTIME;
  uint32_t SME_EXIT_REALTIME;
  uint32_t SME_UPDATE_SCORING;
  uint32_t SME_UPDATE_TELEMETRY;
  uint32_t SME_INIT_APPLICATION;
  uint32_t SME_UNINIT_APPLICATION;
  uint32_t SME_SET_ENVIRONMENT;
  uint32_t SME_FFB;
};

struct LMUGeneric {
  LMUEvent events;
  int32_t gameVersion;
  float FFBTorque;
  LMUApplicationState appInfo;
};

struct LMUScoringData {
  LMUScoringInfo scoringInfo;
  uint8_t scoringStreamSize[12];
  LMUVehicleScoring vehScoringInfo[104];
  uint8_t scoringStream[65536];
};

struct LMUTelemetryData {
  uint8_t activeVehicles;
  uint8_t playerVehicleIdx;
  bool playerHasVehicle;
  LMUVehicleTelemetry telemInfo[104];
};

struct LMUPathData {
  char userData[260];
  char customVariables[260];
  char stewardResults[260];
  char playerProfile[260];
  char pluginsFolder[260];
};

struct LMUObjectOut {
  LMUGeneric generic;
  LMUPathData paths;
  LMUScoringData scoring;
  LMUTelemetryData telemetry;
};

#pragma pack(pop)

#define LMU_MAX_VEHICLES 104

struct LMUSnapshotState {
  uint32_t scoringUpdate;
  uint32_t telemetryUpdate;
  int32_t scoringVehicles;
  uint8_t telemetryVehicles;
};

constexpr bool IsCoherentLmuSnapshot(
    const LMUSnapshotState &before,
    const LMUSnapshotState &snapshot,
    const LMUSnapshotState &after)
{
  return before.scoringUpdate == snapshot.scoringUpdate &&
      snapshot.scoringUpdate == after.scoringUpdate &&
      before.telemetryUpdate == snapshot.telemetryUpdate &&
      snapshot.telemetryUpdate == after.telemetryUpdate &&
      snapshot.scoringVehicles == snapshot.telemetryVehicles;
}

static_assert(IsCoherentLmuSnapshot({1, 2, 3, 3}, {1, 2, 3, 3}, {1, 2, 3, 3}));
static_assert(!IsCoherentLmuSnapshot({1, 2, 3, 3}, {2, 2, 3, 3}, {2, 2, 3, 3}));
static_assert(!IsCoherentLmuSnapshot({1, 2, 3, 3}, {1, 2, 3, 2}, {1, 2, 3, 3}));

static_assert(sizeof(LMUVect3) == 24, "LMUVect3 size mismatch");
static_assert(sizeof(LMUWheel) == 260, "LMUWheel size mismatch");
static_assert(sizeof(LMUVehicleTelemetry) == 1888, "LMUVehicleTelemetry size mismatch");
static_assert(sizeof(LMUVehicleScoring) == 584, "LMUVehicleScoring size mismatch");
static_assert(sizeof(LMUScoringInfo) == 548, "LMUScoringInfo size mismatch");
static_assert(sizeof(LMUApplicationState) == 260, "LMUApplicationState size mismatch");
static_assert(sizeof(LMUEvent) == 64, "LMUEvent size mismatch");
static_assert(sizeof(LMUGeneric) == 332, "LMUGeneric size mismatch");
static_assert(sizeof(LMUScoringData) == 126832, "LMUScoringData size mismatch");
static_assert(sizeof(LMUTelemetryData) == 196356, "LMUTelemetryData size mismatch");
static_assert(sizeof(LMUPathData) == 1300, "LMUPathData size mismatch");
static_assert(sizeof(LMUObjectOut) == 324820, "LMUObjectOut size mismatch");

// Key offset pins (from the Python port). Offsets not pinned here are implied
// by the ordering above and covered by the struct size asserts.
static_assert(offsetof(LMUVehicleTelemetry, mPos) == 160, "LMUVehicleTelemetry.mPos offset");
static_assert(offsetof(LMUVehicleTelemetry, mOri) == 232, "LMUVehicleTelemetry.mOri offset");
static_assert(offsetof(LMUVehicleTelemetry, mEngineRPM) == 356, "LMUVehicleTelemetry.mEngineRPM offset");
static_assert(offsetof(LMUVehicleTelemetry, mFuel) == 524, "LMUVehicleTelemetry.mFuel offset");
static_assert(offsetof(LMUVehicleScoring, mPos) == 264, "LMUVehicleScoring.mPos offset");
static_assert(offsetof(LMUVehicleScoring, mOri) == 336, "LMUVehicleScoring.mOri offset");
static_assert(offsetof(LMUVehicleScoring, mBestLapTime) == 144, "LMUVehicleScoring.mBestLapTime offset");
static_assert(offsetof(LMUVehicleScoring, mTimeBehindLeader) == 244, "LMUVehicleScoring.mTimeBehindLeader offset");
static_assert(offsetof(LMUScoringInfo, mNumVehicles) == 104, "LMUScoringInfo.mNumVehicles offset");
static_assert(offsetof(LMUScoringInfo, mLapDist) == 88, "LMUScoringInfo.mLapDist offset");
static_assert(offsetof(LMUScoringData, vehScoringInfo) == 560, "LMUScoringData.vehScoringInfo offset");
static_assert(offsetof(LMUObjectOut, scoring) == 1632, "LMUObjectOut.scoring offset");
static_assert(offsetof(LMUObjectOut, telemetry) == 128464, "LMUObjectOut.telemetry offset");

#endif // LMU_STRUCT_H