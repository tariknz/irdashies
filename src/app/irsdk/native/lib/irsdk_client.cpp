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

#include <stdio.h>
#include <string.h>

#include <assert.h>
#include "irsdk_defines.h"
#include "yaml_parser.h"
#include "irsdk_client.h"

#pragma warning(disable:4996)

template <typename T>
static T readScalar(const char* data, int entry) {
    T value;
    std::memcpy(&value, data + static_cast<std::size_t>(entry) * sizeof(T), sizeof(T));
    return value;
}

irsdkClient& irsdkClient::instance()
{
	static irsdkClient INSTANCE;
	return INSTANCE;
}

bool irsdkClient::waitForData(int timeoutMS)
{
    const bool hadFrame = m_capture.valid;
    const irsdk_header previous = m_capture.header;
    if (irsdk_waitForDataReady(timeoutMS, &m_capture)) {
        m_data = m_capture.data.data();
        if (!hadFrame || !irdashies::irsdk::sameLayout(previous, m_capture.header)) {
            ++m_statusID;
            m_lastSessionCt = -1;
        }
        return true;
    }
    if (!irsdk_isConnected()) {
        m_capture.valid = false;
        m_data = NULL;
        m_lastSessionCt = -1;
    }
    return false;
}

void irsdkClient::shutdown()
{
    irsdk_shutdown();
    m_capture = {};
    m_data = NULL;
    m_lastSessionCt = -1;
}

bool irsdkClient::isConnected()
{
	return m_capture.valid && irsdk_isConnected();
}

int irsdkClient::getVarIdx(const char*name)
{
	if(isConnected())
	{
		if (name) {
            for (std::size_t i = 0; i < m_capture.variables.size(); ++i) {
                if (std::strncmp(name, m_capture.variables[i].name, IRSDK_MAX_STRING) == 0)
                    return static_cast<int>(i);
            }
        }
	}

	return -1;
}

int /*irsdk_VarType*/ irsdkClient::getVarType(int idx)
{
	if(isConnected())
	{
		const irsdk_varHeader *vh = irdashies::irsdk::capturedVariable(m_capture, idx);
		if(vh)
		{
			return vh->type;
		}
		else
		{
			// Invalid/incompatible descriptors return the safe default below.
		}
	}

	return irsdk_char;
}

int irsdkClient::getVarCount(int idx)
{
	if(isConnected())
	{
		const irsdk_varHeader *vh = irdashies::irsdk::capturedVariable(m_capture, idx);
		if(vh)
		{
			return vh->count;
		}
		else
		{
			// Invalid/incompatible descriptors return the safe default below.
		}
	}

	return 0;
}

bool irsdkClient::getVarBool(int idx, int entry)
{
	if(isConnected())
	{
		const irsdk_varHeader *vh = irdashies::irsdk::capturedVariable(m_capture, idx);
		if(vh)
		{
			if(entry >= 0 && entry < vh->count)
			{
				const char * data = m_data + vh->offset;
				switch(vh->type)
				{
				// 1 byte
				case irsdk_char:
				case irsdk_bool:
					return readScalar<char>(data, entry) != 0;
					break;

				// 4 bytes
				case irsdk_int:
				case irsdk_bitField:
					return readScalar<int>(data, entry) != 0;
					break;
					
				// test float/double for greater than 1.0 so that
				// we have a chance of this being usefull
				// technically there is no right conversion...
				case irsdk_float:
					return readScalar<float>(data, entry) >= 1.0f;
					break;

				// 8 bytes
				case irsdk_double:
					return readScalar<double>(data, entry) >= 1.0;
					break;
				}
			}
			else
			{
				// invalid offset
				assert(false);
			}
		}
		else
		{
			// Invalid/incompatible descriptors return the safe default below.
		}
	}

	return false;
}

int irsdkClient::getVarInt(int idx, int entry)
{
	if(isConnected())
	{
		const irsdk_varHeader *vh = irdashies::irsdk::capturedVariable(m_capture, idx);
		if(vh)
		{
			if(entry >= 0 && entry < vh->count)
			{
				const char * data = m_data + vh->offset;
				switch(vh->type)
				{
				// 1 byte
				case irsdk_char:
				case irsdk_bool:
					return (int)readScalar<char>(data, entry);
					break;

				// 4 bytes
				case irsdk_int:
				case irsdk_bitField:
					return (int)readScalar<int>(data, entry);
					break;
					
				case irsdk_float:
					return (int)readScalar<float>(data, entry);
					break;

				// 8 bytes
				case irsdk_double:
					return (int)readScalar<double>(data, entry);
					break;
				}
			}
			else
			{
				// invalid offset
				assert(false);
			}
		}
		else
		{
			// Invalid/incompatible descriptors return the safe default below.
		}
	}

	return 0;
}

float irsdkClient::getVarFloat(int idx, int entry)
{
	if(isConnected())
	{
		const irsdk_varHeader *vh = irdashies::irsdk::capturedVariable(m_capture, idx);
		if(vh)
		{
			if(entry >= 0 && entry < vh->count)
			{
				const char * data = m_data + vh->offset;
				switch(vh->type)
				{
				// 1 byte
				case irsdk_char:
				case irsdk_bool:
					return (float)readScalar<char>(data, entry);
					break;

				// 4 bytes
				case irsdk_int:
				case irsdk_bitField:
					return (float)readScalar<int>(data, entry);
					break;
					
				case irsdk_float:
					return (float)readScalar<float>(data, entry);
					break;

				// 8 bytes
				case irsdk_double:
					return (float)readScalar<double>(data, entry);
					break;
				}
			}
			else
			{
				// invalid offset
				assert(false);
			}
		}
		else
		{
			// Invalid/incompatible descriptors return the safe default below.
		}
	}

	return 0.0f;
}

double irsdkClient::getVarDouble(int idx, int entry)
{
	if(isConnected())
	{
		const irsdk_varHeader *vh = irdashies::irsdk::capturedVariable(m_capture, idx);
		if(vh)
		{
			if(entry >= 0 && entry < vh->count)
			{
				const char * data = m_data + vh->offset;
				switch(vh->type)
				{
				// 1 byte
				case irsdk_char:
				case irsdk_bool:
					return (double)readScalar<char>(data, entry);
					break;

				// 4 bytes
				case irsdk_int:
				case irsdk_bitField:
					return (double)readScalar<int>(data, entry);
					break;
					
				case irsdk_float:
					return (double)readScalar<float>(data, entry);
					break;

				// 8 bytes
				case irsdk_double:
					return (double)readScalar<double>(data, entry);
					break;
				}
			}
			else
			{
				// invalid offset
				assert(false);
			}
		}
		else
		{
			// Invalid/incompatible descriptors return the safe default below.
		}
	}

	return 0.0;
}

//path is in the form of "DriverInfo:Drivers:CarIdx:{%d}UserName:"
int irsdkClient::getSessionStrVal(const char *path, char *val, int valLen)
{
	if(isConnected() && path && val && valLen > 0)
	{
		// track changes in string
		m_lastSessionCt = getSessionCt(); 

		const char *tVal = NULL;
		int tValLen = 0;
		if(parseYaml(irsdk_getSessionInfoStr(), path, &tVal, &tValLen))
		{
			// dont overflow out buffer
			int len = tValLen;
			if(len > valLen)
				len = valLen;

			// copy what we can, even if buffer too small
			memcpy(val, tVal, len);
			val[len] = '\0'; // origional string has no null termination...

			// if buffer was big enough, return success
			if(valLen >= tValLen)
				return 1;
			else // return size of buffer needed
				return -tValLen;
		}
	}

	return 0;
}

// get the whole string
const char* irsdkClient::getSessionStr() 
{ 
	if(isConnected())
	{
		m_lastSessionCt = getSessionCt(); 
		return irsdk_getSessionInfoStr(); 
	}

	return NULL;
}


//----------------------------------

irsdkCVar::irsdkCVar()
	: m_idx(-1)
	, m_statusID(-1)
{
	m_name[0] = '\0';
}

irsdkCVar::irsdkCVar(const char *name)
{
	m_name[0] = '\0';
	setVarName(name);
}

void irsdkCVar::setVarName(const char *name)
{
	if(!name || 0 != strncmp(name, m_name, sizeof(m_name)))
	{
		m_idx = -1;
		m_statusID = -1;

		if(name)
		{
			strncpy(m_name, name, max_string);
			m_name[max_string-1] = '\0';
		}
		else
			m_name[0] = '\0';
	}
}

bool irsdkCVar::checkIdx()
{
	if(irsdkClient::instance().isConnected())
	{
		if(m_statusID != irsdkClient::instance().getStatusID())
		{
			m_statusID = irsdkClient::instance().getStatusID();
			m_idx = irsdkClient::instance().getVarIdx(m_name);
		}

		return true;
	}

	return false;
}

int /*irsdk_VarType*/ irsdkCVar::getType()
{
	if(checkIdx())
		return irsdkClient::instance().getVarType(m_idx);
	return 0;
}

int irsdkCVar::getCount()
{
	if(checkIdx())
		return irsdkClient::instance().getVarCount(m_idx);
	return 0;
}

bool irsdkCVar::isValid()
{
	checkIdx();
	return (m_idx > -1);
}


bool irsdkCVar::getBool(int entry)
{
	if(checkIdx())
		return irsdkClient::instance().getVarBool(m_idx, entry);
	return false;
}

int irsdkCVar::getInt(int entry)
{
	if(checkIdx())
		return irsdkClient::instance().getVarInt(m_idx, entry);
	return 0;
}

float irsdkCVar::getFloat(int entry)
{
	if(checkIdx())
		return irsdkClient::instance().getVarFloat(m_idx, entry);
	return 0.0f;
}

double irsdkCVar::getDouble(int entry)
{
	if(checkIdx())
		return irsdkClient::instance().getVarDouble(m_idx, entry);
	return 0.0;
}

