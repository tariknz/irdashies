#include "yaml_to_json.h"

#define JSON_NOEXCEPTION 1
#include "json.hpp"

#include <vector>
#include <string>
#include <sstream>
#include <cctype>
#include <cstdlib>
#include <cerrno>
#include <stack>

using json = nlohmann::json;

namespace {

std::string trim(const std::string& str) {
    size_t start = str.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = str.find_last_not_of(" \t\r\n");
    return str.substr(start, end - start + 1);
}

std::string trimTrailingComma(const std::string& str) {
    std::string trimmed = trim(str);
    while (!trimmed.empty() && trimmed.back() == ',') {
        trimmed.pop_back();
        trimmed = trim(trimmed);
    }
    return trimmed;
}

int countIndent(const std::string& line) {
    int count = 0;
    for (char c : line) {
        if (c == ' ') count++;
        else if (c == '\t') count += 2;
        else break;
    }
    return count;
}

bool isArrayItem(const std::string& line) {
    std::string trimmed = trim(line);
    return !trimmed.empty() && trimmed[0] == '-';
}

json parseValue(const std::string& rawValue) {
    std::string value = trimTrailingComma(rawValue);
    
    if (value.empty()) {
        return json(nullptr);
    }
    
    // Check for boolean
    if (value == "true" || value == "True" || value == "TRUE") {
        return json(true);
    }
    if (value == "false" || value == "False" || value == "FALSE") {
        return json(false);
    }
    
    // Check if it's a number
    bool isNumber = true;
    bool hasDecimal = false;
    bool hasSign = false;
    
    for (size_t i = 0; i < value.size(); i++) {
        char c = value[i];
        if (i == 0 && (c == '-' || c == '+')) {
            hasSign = true;
            continue;
        }
        if (c == '.' && !hasDecimal) {
            hasDecimal = true;
            continue;
        }
        if (!std::isdigit(c)) {
            isNumber = false;
            break;
        }
    }
    
    // Don't treat single sign as number
    if (isNumber && value.size() > (hasSign ? 1 : 0)) {
        char* endPtr = nullptr;
        errno = 0;
        
        if (hasDecimal) {
            double dblVal = std::strtod(value.c_str(), &endPtr);
            if (errno == 0 && endPtr == value.c_str() + value.size()) {
                return json(dblVal);
            }
            return json(value); // Fallback to string
        } else {
            long long intVal = std::strtoll(value.c_str(), &endPtr, 10);
            if (errno == 0 && endPtr == value.c_str() + value.size()) {
                return json(intVal);
            }
            // Try double for overflow
            errno = 0;
            double dblVal = std::strtod(value.c_str(), &endPtr);
            if (errno == 0 && endPtr == value.c_str() + value.size()) {
                return json(dblVal);
            }
            return json(value); // Fallback to string
        }
    }
    
    return json(value);
}

struct ParseState {
    json* current;
    int indent;
    std::string key;
    bool isArray;
};

} // anonymous namespace

std::string yamlToJson(const char* yaml) {
    if (!yaml || !*yaml) {
        return "{}";
    }
    
    json root = json::object();
    std::stack<ParseState> stateStack;
    stateStack.push({&root, -1, "", false});
    
    std::istringstream stream(yaml);
    std::string line;
    int lineNum = 0;
    
    while (std::getline(stream, line)) {
        lineNum++;
        
        // Skip empty lines, comments, and YAML document markers
        std::string trimmedLine = trim(line);
        if (trimmedLine.empty() || trimmedLine[0] == '#') {
            continue;
        }
        // Skip YAML document separators (--- and ...)
        if (trimmedLine == "---" || trimmedLine == "...") {
            continue;
        }
        
        int indent = countIndent(line);
        bool isArray = isArrayItem(line);
        
        // Pop states that are at same or higher indent level
        while (stateStack.size() > 1 && stateStack.top().indent >= indent) {
            stateStack.pop();
        }
        
        if (stateStack.empty()) {
            printf("YAML parse error: empty state stack at line %d\n", lineNum);
            return "{}";
        }
        
        ParseState& parentState = stateStack.top();
        json* currentObj = parentState.current;
        
        if (!currentObj) {
            printf("YAML parse error: null parent at line %d\n", lineNum);
            return "{}";
        }
        
        if (isArray) {
            // Array item: "- key: value" or "- value"
            if (trimmedLine.size() < 2) {
                continue; // Skip malformed array items
            }
            std::string content = trim(trimmedLine.substr(1)); // Remove leading '-'
            
            // Convert current object to array if this is first array item
            if (!currentObj->is_array()) {
                *currentObj = json::array();
            }
            
            // Check if this array item has a key (object in array)
            size_t colonPos = content.find(':');
            if (colonPos != std::string::npos && colonPos > 0) {
                std::string key = trim(content.substr(0, colonPos));
                std::string valueStr = (colonPos + 1 < content.size()) 
                    ? trim(content.substr(colonPos + 1)) 
                    : "";
                
                // Create new object for this array item
                json arrayItem = json::object();
                
                if (!valueStr.empty() && !key.empty()) {
                    arrayItem[key] = parseValue(valueStr);
                }
                
                currentObj->push_back(arrayItem);
                
                // Push state for potential nested content
                json& lastItem = currentObj->back();
                stateStack.push({&lastItem, indent, "", true});
            } else {
                // Simple array value
                currentObj->push_back(parseValue(content));
            }
        } else {
            // Key-value pair: "key: value" or "key:"
            size_t colonPos = trimmedLine.find(':');
            if (colonPos != std::string::npos && colonPos > 0) {
                std::string key = trim(trimmedLine.substr(0, colonPos));
                std::string valueStr = (colonPos + 1 < trimmedLine.size())
                    ? trim(trimmedLine.substr(colonPos + 1))
                    : "";
                
                if (key.empty()) {
                    continue; // Skip lines with empty keys
                }
                
                // Make sure we're working with an object
                if (!currentObj->is_object()) {
                    continue;
                }
                
                if (valueStr.empty()) {
                    // No value - create object for potential nesting
                    (*currentObj)[key] = json::object();
                    // Push pointer to the NEW object
                    stateStack.push({&(*currentObj)[key], indent, key, false});
                } else {
                    (*currentObj)[key] = parseValue(valueStr);
                }
            }
        }
    }
    
    return root.dump(-1, ' ', false, json::error_handler_t::replace);
}
