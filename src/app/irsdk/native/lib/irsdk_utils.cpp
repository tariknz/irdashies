/*
Copyright (c) 2013, iRacing.com Motorsport Simulations, LLC.
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of iRacing.com Motorsport Simulations nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

#define MIN_WIN_VER 0x0501

#ifndef WINVER
#	define WINVER			MIN_WIN_VER
#endif

#ifndef _WIN32_WINNT
#	define _WIN32_WINNT		MIN_WIN_VER 
#endif

#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <stdio.h>
#include <time.h>
#include <limits.h>

#ifdef _MSC_VER
#include <crtdbg.h>
#endif

#include "irsdk_capture.h"

// for timeBeginPeriod()
#pragma comment(lib, "Winmm")
// for RegisterWindowMessage() and SendMessage()
#pragma comment(lib, "User32")

// Local memory

static HANDLE hDataValidEvent = NULL;
static HANDLE hMemMapFile = NULL;

static const char *pSharedMem = NULL;
static const irsdk_header *pHeader = NULL;
static std::size_t mappedBytes = 0;

static int lastTickCount = INT_MAX;
static bool isInitialized = false;

#ifdef IRDASHIES_IRSDK_REPLAY_NAMES
static const double timeout = 2.0; // Keep replay integration tests fast.
#else
static const double timeout = 30.0; // timeout after 30 seconds with no communication
#endif
static time_t lastValidTime = 0;

// Count only committed, readable pages belonging to this view. The mapping is
// owned until shutdown, so a producer reconnect cannot invalidate our view.
static std::size_t readableViewSize(const char* base)
{
    std::size_t size = 0;
    while (size < irdashies::irsdk::maxMappingBytes) {
        MEMORY_BASIC_INFORMATION info{};
        if (!VirtualQuery(base + size, &info, sizeof(info)) ||
            info.AllocationBase != base || info.State != MEM_COMMIT ||
            (info.Protect & (PAGE_NOACCESS | PAGE_GUARD)) != 0 ||
            info.RegionSize == 0) break;
        const auto remaining = irdashies::irsdk::maxMappingBytes - size;
        size += info.RegionSize < remaining ? info.RegionSize : remaining;
    }
    return size;
}

// Function Implementations

bool irsdk_startup()
{
	if(!hMemMapFile)
	{
		hMemMapFile = OpenFileMapping( FILE_MAP_READ, FALSE, IRSDK_MEMMAPFILENAME);
		lastTickCount = INT_MAX;
	}

	if(hMemMapFile)
	{
		if(!pSharedMem)
		{
			pSharedMem = (const char *)MapViewOfFile(hMemMapFile, FILE_MAP_READ, 0, 0, 0);
			mappedBytes = pSharedMem ? readableViewSize(pSharedMem) : 0;
            if (pSharedMem && mappedBytes < sizeof(irsdk_header)) {
                UnmapViewOfFile(pSharedMem);
                pSharedMem = NULL;
                mappedBytes = 0;
            }
            pHeader = (const irsdk_header *)pSharedMem;
			lastTickCount = INT_MAX;
		}

		if(pSharedMem)
		{
			if(!hDataValidEvent)
			{
				hDataValidEvent = OpenEvent(SYNCHRONIZE, false, IRSDK_DATAVALIDEVENTNAME);
				lastTickCount = INT_MAX;
			}

			if(hDataValidEvent)
			{
				isInitialized = true;
				return isInitialized;
			}
			//else printf("Error opening event: %d\n", GetLastError()); 
		}
		//else printf("Error mapping file: %d\n", GetLastError()); 
	}
	//else printf("Error opening file: %d\n", GetLastError()); 

	isInitialized = false;
	return isInitialized;
}

void irsdk_shutdown()
{
	if(hDataValidEvent)
		CloseHandle(hDataValidEvent);

	if(pSharedMem)
		UnmapViewOfFile(pSharedMem);

	if(hMemMapFile)
		CloseHandle(hMemMapFile);

	hDataValidEvent = NULL;
	pSharedMem = NULL;
	pHeader = NULL;
    mappedBytes = 0;
	hMemMapFile = NULL;

	isInitialized = false;
	lastTickCount = INT_MAX;
}

bool irsdk_getNewData(irsdk_capture *capture)
{
    if (!(isInitialized || irsdk_startup())) {
        if (capture) capture->valid = false;
        return false;
    }
    // A paused replay's connected header remains a heartbeat.
    if (pHeader && (pHeader->status & irsdk_stConnected))
        lastValidTime = time(NULL);
    const auto read = [](std::size_t offset, void* destination, std::size_t size) {
        if (!pSharedMem || !irdashies::irsdk::byteRange(offset, size, mappedBytes))
            return false;
        memcpy(destination, pSharedMem + offset, size);
        return true;
    };
    return irdashies::irsdk::captureFrame(read, mappedBytes, lastTickCount, capture);
}

bool irsdk_waitForDataReady(int timeOut, irsdk_capture *capture)
{
    if (timeOut < 0) timeOut = 0;
    if (isInitialized || irsdk_startup()) {
        if (irsdk_getNewData(capture)) return true;
        WaitForSingleObject(hDataValidEvent, timeOut);
        // Capture revalidates and resizes using a fresh header after the wait.
        return irsdk_getNewData(capture);
    }
    if (capture) capture->valid = false;
    if (timeOut > 0) Sleep(timeOut);
    return false;
}


bool irsdk_isConnected()
{
	if(isInitialized)
	{
		int elapsed = (int)difftime(time(NULL), lastValidTime);
		return (pHeader->status & irsdk_stConnected) > 0 && elapsed < timeout;
	}

	return false;
}

const irsdk_header *irsdk_getHeader()
{
	if(isInitialized)
	{
		return pHeader;
	}

	return NULL;
}

// direct access to the data buffer
// Warnign! This buffer is volitile so read it out fast!
// Use the cached copy from irsdk_waitForDataReady() or irsdk_getNewData() instead
const char *irsdk_getData(int index)
{
    if (!isInitialized || !pHeader) return NULL;
    const irsdk_header header = *pHeader;
    if (!irdashies::irsdk::validLayout(header, mappedBytes) ||
        index < 0 || index >= header.numBuf) return NULL;
    return pSharedMem + header.varBuf[index].bufOffset;
}

const char *irsdk_getSessionInfoStr()
{
	if(isInitialized)
	{
		return pSharedMem + pHeader->sessionInfoOffset;
	}
	return NULL;
}

int irsdk_getSessionInfoStrUpdate()
{
	if(isInitialized)
	{
		return pHeader->sessionInfoUpdate;
	}
	return -1;
}

const irsdk_varHeader *irsdk_getVarHeaderPtr()
{
    if (!isInitialized || !pHeader) return NULL;
    const irsdk_header header = *pHeader;
    if (!irdashies::irsdk::validLayout(header, mappedBytes) ||
        header.varHeaderOffset % alignof(irsdk_varHeader) != 0) return NULL;
    return reinterpret_cast<const irsdk_varHeader*>(pSharedMem + header.varHeaderOffset);
}

const irsdk_varHeader *irsdk_getVarHeaderEntry(int index)
{
    if (!isInitialized || !pHeader) return NULL;
    const irsdk_header header = *pHeader;
    if (!irdashies::irsdk::validLayout(header, mappedBytes) || index < 0 ||
        index >= header.numVars ||
        header.varHeaderOffset % alignof(irsdk_varHeader) != 0) return NULL;
    return reinterpret_cast<const irsdk_varHeader*>(pSharedMem + header.varHeaderOffset) + index;
}

// Note: this is a linear search, so cache the results
int irsdk_varNameToIndex(const char *name)
{
	const irsdk_varHeader *pVar;

	if(name && isInitialized && pHeader)
	{
        const int count = pHeader->numVars;
        if (count < 0 || count > irdashies::irsdk::maxVariables) return -1;
		for(int index=0; index<count; index++)
		{
			pVar = irsdk_getVarHeaderEntry(index);
			if(pVar && 0 == strncmp(name, pVar->name, IRSDK_MAX_STRING))
			{
				return index;
			}
		}
	}

	return -1;
}

int irsdk_varNameToOffset(const char *name)
{
	const irsdk_varHeader *pVar;

	if(name && isInitialized && pHeader)
	{
        const int count = pHeader->numVars;
        if (count < 0 || count > irdashies::irsdk::maxVariables) return -1;
		for(int index=0; index<count; index++)
		{
			pVar = irsdk_getVarHeaderEntry(index);
			if(pVar && 0 == strncmp(name, pVar->name, IRSDK_MAX_STRING))
			{
				return pVar->offset;
			}
		}
	}

	return -1;
}

unsigned int irsdk_getBroadcastMsgID()
{
	static unsigned int msgId = RegisterWindowMessage(IRSDK_BROADCASTMSGNAME); 

	return msgId;
}

void irsdk_broadcastMsg(irsdk_BroadcastMsg msg, int var1, int var2, int var3)
{
	irsdk_broadcastMsg(msg, var1, static_cast<int>MAKELONG(var2, var3));
}

void irsdk_broadcastMsg(irsdk_BroadcastMsg msg, int var1, float var2)
{
	// multiply by 2^16-1 to move fractional part to the integer part
	int real = (int)(var2 * 65536.0f);

	irsdk_broadcastMsg(msg, var1, real);
}

void irsdk_broadcastMsg(irsdk_BroadcastMsg msg, int var1, int var2)
{
	static unsigned int msgId = irsdk_getBroadcastMsgID();

	if(msgId && msg >= 0 && msg < irsdk_BroadcastLast)
	{
		SendNotifyMessage(HWND_BROADCAST, msgId, MAKELONG(msg, var1), var2);
	}
}

int irsdk_padCarNum(int num, int zero)
{
	int retVal = num;
	int numPlace = 1;
	if(num > 99)
		numPlace = 3;
	else if(num > 9)
		numPlace = 2;
	if(zero)
	{
		numPlace += zero;
		retVal = num + 1000*numPlace;
	}

	return retVal;
}
