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

#ifndef IRSDKCLIENT_H
#define IRSDKCLIENT_H

// A C++ wrapper around the irsdk calls that takes care of the details of maintaining a connection.
// reads out the data into a cache so you don't have to worry about timming
class irsdkClient
{
public:
	// singleton
	static irsdkClient& instance();

	// wait for live data, or if a .ibt file is open
	// then read the next line from the file.
	bool waitForData(int timeoutMS = 16);

	bool isConnected();
	int getStatusID() { return m_statusID; }

	int getVarIdx(const char*name);

	// what is the base type of the data
	// returns irsdk_VarType as int so we don't depend on irsdk_defines.h
	int getVarType(int idx);
	int getVarType(const char *name) { return getVarType(getVarIdx(name)); }

	// how many elements in array, or 1 if not an array
	int getVarCount(int idx);
	int getVarCount(const char *name) { return getVarCount(getVarIdx(name)); }

	// idx is the variables index, entry is the array offset, or 0 if not an array element
	// will convert data to requested type
	bool getVarBool(int idx, int entry = 0);
	bool getVarBool(const char *name, int entry = 0) { return getVarBool(getVarIdx(name), entry); }

	int getVarInt(int idx, int entry = 0);
	int getVarInt(const char *name, int entry = 0) { return getVarInt(getVarIdx(name), entry); }
	
	float getVarFloat(int idx, int entry = 0);
	float getVarFloat(const char *name, int entry = 0) { return getVarFloat(getVarIdx(name), entry); }

	double getVarDouble(int idx, int entry = 0);
	double getVarDouble(const char *name, int entry = 0) { return getVarDouble(getVarIdx(name), entry); }

	//---

	// value that increments with each update to string
	int getSessionCt() { return irsdk_getSessionInfoStrUpdate(); }

	// has string changed since we last read any values from it
	bool wasSessionStrUpdated() { return m_lastSessionCt != getSessionCt(); } 

	// pars string for individual value, 1 success, 0 failure, -n minimum buffer size
	//****Note, this is a linear parser, so it is slow!
	int getSessionStrVal(const char *path, char *val, int valLen);

	// get the whole string
	const char *getSessionStr();

protected:

	irsdkClient()
		: m_data(NULL)
		, m_nData(0)
		, m_statusID(0)
		, m_lastSessionCt(-1)
	{ }

	~irsdkClient() { shutdown(); }

	void shutdown();

	char *m_data;
	int m_nData;
	int m_statusID;

	int m_lastSessionCt;

	static irsdkClient *m_instance;
};


// helper class to keep track of our variables index
// Create a global instance of this and it will take care of the details for you.
class irsdkCVar
{
public:
	irsdkCVar();
	irsdkCVar(const char *name);

	void setVarName(const char *name);

	// returns irsdk_VarType as int so we don't depend on irsdk_defines.h
	int getType();
	int getCount();
	bool isValid();

	// entry is the array offset, or 0 if not an array element
	bool getBool(int entry = 0);
	int getInt(int entry = 0);
	float getFloat(int entry = 0);
	double getDouble(int entry = 0);

protected:
	bool checkIdx();

	static const int max_string = 32; //IRSDK_MAX_STRING
	char m_name[max_string];
	int m_idx;
	int m_statusID;
};

#endif // IRSDKCLIENT_H
