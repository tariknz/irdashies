#ifndef YAML_TO_JSON_H
#define YAML_TO_JSON_H

#include <string>
#include "json.hpp"

std::string yamlToJson(const char* yaml);
nlohmann::json yamlToJsonObject(const char* yaml);

#endif // YAML_TO_JSON_H
