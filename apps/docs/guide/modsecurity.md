# ModSecurity WAF Guide

This comprehensive guide covers ModSecurity Web Application Firewall (WAF) configuration in the Nginx Warden, including OWASP Core Rule Set (CRS) management, custom rule creation, and advanced security configurations.

## Overview

ModSecurity is a web application firewall that protects your web applications from various attacks, including:

- **SQL Injection (SQLi)**: Prevents database injection attacks
- **Cross-Site Scripting (XSS)**: Blocks malicious script injection
- **Remote File Inclusion (RFI)**: Prevents inclusion of remote files
- **Local File Inclusion (LFI)**: Blocks local file access attempts
- **Command Injection**: Prevents system command execution
- **Session Fixation**: Protects against session hijacking
- **Authentication Bypass**: Blocks unauthorized access attempts

## ModSecurity Interface

Access ModSecurity settings by:
1. Click **Domains** in the sidebar
2. Select a domain from the list
3. Click the **ModSecurity** tab

![ModSecurity](/reference/screenshots/modsecurity.png)

The ModSecurity interface provides:
- **Global Settings**: Enable/disable ModSecurity globally
- **CRS Rules**: OWASP Core Rule Set management
- **Custom Rules**: User-defined security rules
- **Rule Categories**: Organized rule categories
- **Paranoia Levels**: Security sensitivity settings

## Enabling ModSecurity

### Global ModSecurity Settings

1. Click **ModSecurity** in the sidebar
2. Configure global settings:
   - **Enable ModSecurity**: Turn on WAF protection
   - **Default Paranoia Level**: Set default security level
   - **Audit Logging**: Enable/disable security event logging

### Domain-Specific ModSecurity

1. Select a domain from the list
2. Click the **ModSecurity** tab
3. Toggle **Enable ModSecurity** for this domain
4. Configure domain-specific settings

## OWASP Core Rule Set (CRS)

The OWASP CRS is a set of generic attack detection rules that provide protection against many common attack categories.

### CRS Rule Categories

#### 1. Request Rule Set
- **REQUEST-930-APPLICATION-ATTACK-LFI**: Local file inclusion attacks
- **REQUEST-931-APPLICATION-ATTACK-RFI**: Remote file inclusion attacks
- **REQUEST-932-APPLICATION-ATTACK-RCE**: Remote code execution attacks
- **REQUEST-933-APPLICATION-ATTACK-PHP**: PHP injection attacks
- **REQUEST-941-APPLICATION-ATTACK-XSS**: Cross-site scripting attacks
- **REQUEST-942-APPLICATION-ATTACK-SQLI**: SQL injection attacks
- **REQUEST-943-APPLICATION-ATTACK-SESSION-FIXATION**: Session fixation attacks


### Managing CRS Rules

#### Enable/Disable Rule Categories

1. Select your domain
2. Click the **ModSecurity** tab
3. View available rule categories
4. Toggle categories on/off as needed

#### Configure Individual Rules

1. Click on a rule category to expand it
2. View individual rules within the category
3. Toggle specific rules on/off
4. Configure rule-specific settings


## Custom Rules

Create custom ModSecurity rules for application-specific security requirements.

### Rule Syntax

ModSecurity rules follow this syntax:
```modsecurity
SecRule VARIABLES OPERATOR [ACTIONS]
```

#### Example Custom Rules

#### Block SQL Injection Attempts
```modsecurity
SecRule ARGS "@detectSQLi" \
    "id:1001,\
    phase:2,\
    block,\
    msg:'SQL Injection Attack Detected',\
    logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',\
    tag:'application-multi',\
    tag:'language-multi',\
    tag:'platform-multi',\
    tag:'attack-sqli'"
```

#### Block XSS Attempts
```modsecurity
SecRule ARGS "@detectXSS" \
    "id:1002,\
    phase:2,\
    block,\
    msg:'XSS Attack Detected',\
    logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',\
    tag:'application-multi',\
    tag:'language-multi',\
    tag:'platform-multi',\
    tag:'attack-xss'"
```

#### Block Bad User Agents
```modsecurity
SecRule REQUEST_HEADERS:User-Agent "@pmFromFile bad-user-agents.data" \
    "id:1003,\
    phase:1,\
    block,\
    msg:'Bad User Agent Blocked',\
    logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',\
    tag:'application-multi',\
    tag:'language-multi',\
    tag:'platform-multi',\
    tag:'attack-useragent'"
```

#### Rate Limiting
```modsecurity
SecRule IP:@ipMatch "192.168.1.0/24" \
    "id:1004,\
    phase:1,\
    nolog,\
    pass,\
    ctl:ruleEngine=Off"
```

### Creating Custom Rules

1. Select your domain
2. Click the **ModSecurity** tab
3. Click **Add Custom Rule**
4. Fill in rule details:
   - **Name**: Descriptive rule name
   - **Category**: Rule category (e.g., "Custom Security")
   - **Rule Content**: ModSecurity rule syntax
   - **Description**: What the rule does
   - **Enabled**: Enable/disable the rule

5. Click **Save**

### Rule Variables

ModSecurity provides various variables for rule matching:

#### Request Variables
- `ARGS`: All request parameters
- `ARGS_NAMES`: Parameter names
- `ARGS_GET`: GET parameters
- `ARGS_POST`: POST parameters
- `REQUEST_HEADERS`: Request headers
- `REQUEST_COOKIES`: Request cookies
- `REQUEST_URI`: Request URI
- `REQUEST_METHOD`: HTTP method
- `REQUEST_BODY`: Request body

#### Response Variables
- `RESPONSE_HEADERS`: Response headers
- `RESPONSE_BODY`: Response body
- `RESPONSE_STATUS`: HTTP status code

### Operators

ModSecurity provides various operators for pattern matching:

#### String Operators
- `@rx`: Regular expression match
- `@pm`: Phrase match (any of the phrases)
- `@pmFromFile`: Phrase match from file
- `@contains`: Contains string
- `@beginsWith`: Begins with string
- `@endsWith`: Ends with string

#### Numeric Operators
- `@eq`: Equal to
- `@gt`: Greater than
- `@lt`: Less than
- `@ge`: Greater than or equal to
- `@le`: Less than or equal to

#### Special Operators
- `@detectSQLi`: SQL injection detection
- `@detectXSS`: XSS detection
- `@validateUtf8Encoding`: UTF-8 validation
- `@validateByteRange`: Byte range validation

## Rule Actions

ModSecurity supports various actions for rule processing:

### Disruptive Actions
- **deny**: Deny the request with a 403 status
- **block**: Block the request (depends on configuration)
- **drop**: Drop the connection
- **redirect**: Redirect to another URL
- **pass**: Continue processing (no action)

### Flow Actions
- **phase**: Set processing phase (1-5)
- **t:none**: No transformation
- **t:lowercase`: Convert to lowercase
- **t:urlDecode`: URL decode
- **t:htmlEntityDecode`: HTML entity decode

### Data Actions
- **log**: Log the rule match
- **nolog**: Do not log the rule match
- **auditlog**: Write to audit log
- **noauditlog**: Do not write to audit log

### Metadata Actions
- **id**: Unique rule identifier
- **msg**: Rule message
- **logdata**: Additional log data
- **tag**: Rule tags
- **severity**: Rule severity (1-5)

## Advanced Configuration

### Exception Handling

Create exceptions for legitimate traffic that might be blocked:

#### IP Whitelist
```modsecurity
SecRule REMOTE_ADDR "@ipMatch 192.168.1.100" \
    "id:2001,\
    phase:1,\
    nolog,\
    pass,\
    ctl:ruleEngine=Off"
```

#### URI Whitelist
```modsecurity
SecRule REQUEST_URI "@beginsWith /api/public/" \
    "id:2002,\
    phase:1,\
    nolog,\
    pass,\
    ctl:ruleRemoveById 941100"
```

#### Parameter Whitelist
```modsecurity
SecRule ARGS:product_code "@rx ^[A-Z0-9-]+$" \
    "id:2003,\
    phase:2,\
    nolog,\
    pass,\
    ctl:ruleRemoveTargetById 942100;ARGS:product_code"
```

### Anomaly Scoring

Configure anomaly scoring for advanced threat detection:

```modsecurity
# Set anomaly score threshold
SecAction "id:9001,\
    phase:1,\
    nolog,\
    pass,\
    t:none,\
    setvar:tx.anomaly_score_threshold=5"

# Increase anomaly score for suspicious requests
SecRule ARGS "@detectSQLi" \
    "id:9002,\
    phase:2,\
    pass,\
    msg:'SQL Injection Attempt',\
    logdata:'Matched Data: %{MATCHED_VAR} found within %{MATCHED_VAR_NAME}',\
    tag:'attack-sqli',\
    setvar:tx.anomaly_score=+3"

# Block high anomaly scores
SecRule TX:ANOMALY_SCORE "@gt %{tx.anomaly_score_threshold}" \
    "id:9003,\
    phase:2,\
    block,\
    msg:'Anomaly Score Exceeded'"
```





For more information on related topics:
- [Domain Management](/guide/domains)
- [SSL Certificate Management](/guide/ssl)
- [Log Analysis](/guide/logs)
- [Performance Monitoring](/guide/performance)