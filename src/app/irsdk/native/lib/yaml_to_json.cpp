#include "yaml_to_json.h"
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
        if (hasDecimal) {
            return json(std::stod(value));
        } else {
            // Use strtoll to avoid exceptions (NAPI_DISABLE_CPP_EXCEPTIONS)
            char* endPtr = nullptr;
            errno = 0;
            long long intVal = std::strtoll(value.c_str(), &endPtr, 10);
            if (errno == 0 && endPtr == value.c_str() + value.size()) {
                return json(intVal);
            }
            // Fallback to double for overflow
            return json(std::stod(value));
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
    
    while (std::getline(stream, line)) {
        // Skip empty lines and comments
        std::string trimmedLine = trim(line);
        if (trimmedLine.empty() || trimmedLine[0] == '#') {
            continue;
        }
        
        int indent = countIndent(line);
        bool isArray = isArrayItem(line);
        
        // Pop states that are at same or higher indent level
        while (stateStack.size() > 1 && stateStack.top().indent >= indent) {
            stateStack.pop();
        }
        
        ParseState& parentState = stateStack.top();
        json* parent = parentState.current;
        
        if (isArray) {
            // Array item: "- key: value" or "- value"
            std::string content = trim(trimmedLine.substr(1)); // Remove leading '-'
            
            // Ensure parent has array for current key if needed
            if (!parentState.key.empty() && !parent->contains(parentState.key)) {
                (*parent)[parentState.key] = json::array();
            }
            
            json* targetArray = parent;
            if (!parentState.key.empty()) {
                targetArray = &(*parent)[parentState.key];
            }
            
            // Check if this array item has a key
            size_t colonPos = content.find(':');
            if (colonPos != std::string::npos) {
                std::string key = trim(content.substr(0, colonPos));
                std::string valueStr = trim(content.substr(colonPos + 1));
                
                // Create new object for this array item
                json arrayItem = json::object();
                
                if (!valueStr.empty()) {
                    arrayItem[key] = parseValue(valueStr);
                }
                
                targetArray->push_back(arrayItem);
                
                // Push state for potential nested content
                json& lastItem = targetArray->back();
                stateStack.push({&lastItem, indent, key, true});
            } else {
                // Simple array value
                targetArray->push_back(parseValue(content));
            }
        } else {
            // Key-value pair: "key: value" or "key:"
            size_t colonPos = trimmedLine.find(':');
            if (colonPos != std::string::npos) {
                std::string key = trim(trimmedLine.substr(0, colonPos));
                std::string valueStr = trim(trimmedLine.substr(colonPos + 1));
                
                if (valueStr.empty()) {
                    // No value - could be object or array (determined by next line)
                    // For now, create as object, will be converted if needed
                    (*parent)[key] = json::object();
                    stateStack.push({parent, indent, key, false});
                } else {
                    (*parent)[key] = parseValue(valueStr);
                }
            }
        }
    }
    
    return root.dump();
}
