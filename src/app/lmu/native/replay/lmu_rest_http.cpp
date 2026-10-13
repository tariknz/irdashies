#include "lmu_rest_http.h"

#include <cstring>
#include <vector>

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <winsock2.h>
#include <ws2tcpip.h>

namespace irdashies::lmu_replay {
namespace {

/** A response larger than this is not something LMU's API serves. */
constexpr std::size_t kMaxResponseSize = 8u * 1024u * 1024u;
constexpr std::size_t kReadChunk = 16384;

bool gStarted = false;

/** Applies the timeout to both directions, so neither can hang the thread. */
void applyTimeout(SOCKET socketHandle, int timeoutMs) {
  const DWORD value = static_cast<DWORD>(timeoutMs);
  setsockopt(
      socketHandle,
      SOL_SOCKET,
      SO_RCVTIMEO,
      reinterpret_cast<const char*>(&value),
      sizeof(value));
  setsockopt(
      socketHandle,
      SOL_SOCKET,
      SO_SNDTIMEO,
      reinterpret_cast<const char*>(&value),
      sizeof(value));
}

/** True for a status line carrying a 2xx. */
bool isSuccessStatus(const std::string& response) {
  const auto lineEnd = response.find("\r\n");
  if (lineEnd == std::string::npos) return false;
  const std::string statusLine = response.substr(0, lineEnd);
  // "HTTP/1.1 200 OK" -- the code follows the first space.
  const auto space = statusLine.find(' ');
  if (space == std::string::npos || space + 2 >= statusLine.size()) {
    return false;
  }
  return statusLine[space + 1] == '2';
}

}  // namespace

bool httpStartup(std::string& error) {
  if (gStarted) return true;
  WSADATA data{};
  const int result = WSAStartup(MAKEWORD(2, 2), &data);
  if (result != 0) {
    error = "WSAStartup failed";
    return false;
  }
  gStarted = true;
  return true;
}

void httpShutdown() {
  if (!gStarted) return;
  WSACleanup();
  gStarted = false;
}

HttpResult httpGet(
    const std::string& host,
    std::uint16_t port,
    const std::string& path,
    int timeoutMs,
    std::string& body) {
  body.clear();

  addrinfo hints{};
  hints.ai_family = AF_INET;  // The API is served on 127.0.0.1.
  hints.ai_socktype = SOCK_STREAM;
  hints.ai_protocol = IPPROTO_TCP;

  const std::string portText = std::to_string(port);
  addrinfo* resolved = nullptr;
  if (getaddrinfo(host.c_str(), portText.c_str(), &hints, &resolved) != 0 ||
      resolved == nullptr) {
    return HttpResult::Network;
  }

  SOCKET socketHandle =
      socket(resolved->ai_family, resolved->ai_socktype, resolved->ai_protocol);
  if (socketHandle == INVALID_SOCKET) {
    freeaddrinfo(resolved);
    return HttpResult::Network;
  }
  applyTimeout(socketHandle, timeoutMs);

  const int connected = connect(
      socketHandle,
      resolved->ai_addr,
      static_cast<int>(resolved->ai_addrlen));
  const int connectError = WSAGetLastError();
  freeaddrinfo(resolved);
  if (connected == SOCKET_ERROR) {
    closesocket(socketHandle);
    // Nothing listening is the ordinary answer when the API is absent, and is
    // reported separately so the caller can stop asking rather than retry.
    if (connectError == WSAECONNREFUSED) return HttpResult::Refused;
    if (connectError == WSAETIMEDOUT) return HttpResult::Timeout;
    return HttpResult::Network;
  }

  // Connection: close, so the body ends at EOF and there is no Content-Length
  // or chunked framing to parse. See the header for why that trade is right.
  const std::string request = "GET " + path +
                              " HTTP/1.1\r\nHost: " + host +
                              "\r\nAccept: application/json\r\nConnection: "
                              "close\r\n\r\n";
  std::size_t sent = 0;
  while (sent < request.size()) {
    const int wrote = send(
        socketHandle,
        request.data() + sent,
        static_cast<int>(request.size() - sent),
        0);
    if (wrote == SOCKET_ERROR) {
      const int error = WSAGetLastError();
      closesocket(socketHandle);
      return error == WSAETIMEDOUT ? HttpResult::Timeout : HttpResult::Network;
    }
    sent += static_cast<std::size_t>(wrote);
  }

  std::string response;
  std::vector<char> chunk(kReadChunk);
  while (true) {
    const int read =
        recv(socketHandle, chunk.data(), static_cast<int>(chunk.size()), 0);
    if (read == 0) break;  // Server closed: the response is complete.
    if (read == SOCKET_ERROR) {
      const int error = WSAGetLastError();
      closesocket(socketHandle);
      return error == WSAETIMEDOUT ? HttpResult::Timeout : HttpResult::Network;
    }
    response.append(chunk.data(), static_cast<std::size_t>(read));
    if (response.size() > kMaxResponseSize) {
      closesocket(socketHandle);
      return HttpResult::Network;
    }
  }
  closesocket(socketHandle);

  if (!isSuccessStatus(response)) return HttpResult::Status;

  const auto headerEnd = response.find("\r\n\r\n");
  if (headerEnd == std::string::npos) return HttpResult::Network;
  body = response.substr(headerEnd + 4);
  return HttpResult::Ok;
}

}  // namespace irdashies::lmu_replay
