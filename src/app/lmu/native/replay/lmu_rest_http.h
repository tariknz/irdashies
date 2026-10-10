#ifndef IRDASHIES_LMU_REST_HTTP_H
#define IRDASHIES_LMU_REST_HTTP_H

#include <cstdint>
#include <string>

namespace irdashies::lmu_replay {

/**
 * A blocking HTTP GET, for the recorder only.
 *
 * Deliberately tiny. The target is LMU's own REST API on loopback, serving a
 * few KB of JSON, so this handles exactly that: one request per connection
 * with `Connection: close`, then read to EOF. That removes the need to parse
 * Content-Length or chunked encoding at all, which is most of what a real HTTP
 * client is for. A connection per request on loopback is cheap, and the
 * recorder is not the app -- robustness is worth more here than throughput.
 *
 * The app itself does not use this: it reaches the same API from the JS side,
 * where node:http already exists. See src/app/lmu/rest/httpJson.ts.
 */
enum class HttpResult {
  Ok,
  /** Nothing listening. The ordinary answer when the API is not present. */
  Refused,
  Timeout,
  /** Reached it, but the response was not a 200. */
  Status,
  Network,
};

/** Must be called once before any httpGet, and matched by httpShutdown. */
bool httpStartup(std::string& error);
void httpShutdown();

/**
 * Fetches `path`. On HttpResult::Ok, `body` holds the response body with the
 * headers stripped.
 */
HttpResult httpGet(
    const std::string& host,
    std::uint16_t port,
    const std::string& path,
    int timeoutMs,
    std::string& body);

}  // namespace irdashies::lmu_replay

#endif
