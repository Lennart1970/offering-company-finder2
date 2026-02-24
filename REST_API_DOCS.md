# REST API Documentation for Microsoft Dataverse Integration

## Overview

This REST API provides external access to the offering-company-finder application data for integration with Microsoft Dataverse, Power Automate, and other external systems.

**Base URL:** `https://your-domain.manus.space/api/v1`

## Authentication

All API endpoints require Bearer token authentication.

**Header:**
```
Authorization: Bearer YOUR_API_KEY
```

**API Key:** Set via the `API_KEY` environment variable (currently: `cg-api-key-2026`)

**Error Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

---

## Endpoints

### 1. List All Companies

**GET** `/api/v1/companies`

Retrieves a paginated list of all companies across all searches.

**Query Parameters:**
- `limit` (optional, default: 50, max: 100): Number of companies per page
- `offset` (optional, default: 0): Number of companies to skip

**Example Request:**
```bash
curl -X GET "https://your-domain.manus.space/api/v1/companies?limit=10&offset=0" \
  -H "Authorization: Bearer cg-api-key-2026"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cm7abc123",
      "name": "Acme Corporation",
      "domain": "acme.com",
      "city": "San Francisco",
      "state": "California",
      "country": "United States",
      "industry": "Software",
      "employeeCount": 250,
      "revenue": 50000000,
      "linkedinUrl": "https://linkedin.com/company/acme",
      "twitterUrl": "https://twitter.com/acme",
      "facebookUrl": "https://facebook.com/acme",
      "parentCompany": "Acme Holdings Inc.",
      "subsidiaries": "Acme Labs, Acme Cloud",
      "searchId": "cm7search456",
      "createdAt": "2026-02-24T08:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 2. Get Single Company

**GET** `/api/v1/companies/:id`

Retrieves detailed information for a single company, including deep research brief and sales approach if available.

**Path Parameters:**
- `id` (required): Company ID

**Example Request:**
```bash
curl -X GET "https://your-domain.manus.space/api/v1/companies/cm7abc123" \
  -H "Authorization: Bearer cg-api-key-2026"
```

**Response (200 OK):**
```json
{
  "id": "cm7abc123",
  "name": "Acme Corporation",
  "domain": "acme.com",
  "city": "San Francisco",
  "state": "California",
  "country": "United States",
  "industry": "Software",
  "employeeCount": 250,
  "revenue": 50000000,
  "linkedinUrl": "https://linkedin.com/company/acme",
  "twitterUrl": "https://twitter.com/acme",
  "facebookUrl": "https://facebook.com/acme",
  "parentCompany": "Acme Holdings Inc.",
  "subsidiaries": "Acme Labs, Acme Cloud",
  "searchId": "cm7search456",
  "createdAt": "2026-02-24T08:00:00.000Z",
  "briefData": {
    "urgencyScore": 85,
    "urgencyReasoning": "Recent expansion into APAC market indicates active growth phase",
    "companyIntelligence": "Acme Corporation is a mid-market SaaS provider...",
    "recentDevelopments": [
      {
        "text": "2026: Launched new IoT sensor product line",
        "date": "2026-01-15"
      }
    ],
    "verifiedSources": [
      {
        "url": "https://acme.com/press-release",
        "title": "Acme Launches IoT Sensors",
        "snippet": "Acme Corporation announced today...",
        "date": "2026-01-15",
        "type": "web"
      }
    ]
  },
  "salesApproachData": {
    "conversationStarters": [
      "I noticed your recent expansion into IoT sensors..."
    ],
    "emailTemplate": "Subject: Helping Acme scale IoT operations...",
    "linkedinMessage": "Hi [Name], I saw Acme's recent IoT launch...",
    "callScript": "Opening: Hi [Name], this is [Your Name] from..."
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Company not found"
}
```

---

### 3. List All Searches

**GET** `/api/v1/searches`

Retrieves a list of all search runs with their metadata.

**Example Request:**
```bash
curl -X GET "https://your-domain.manus.space/api/v1/searches" \
  -H "Authorization: Bearer cg-api-key-2026"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cm7search456",
      "url": "https://acme.com",
      "location": "San Francisco, CA",
      "status": "completed",
      "offeringData": {
        "coreOffering": "Cloud-based project management software",
        "targetMarket": "Mid-market technology companies",
        "valueProposition": "Streamline workflows with AI-powered automation"
      },
      "codeTargetingData": {
        "sicCodes": ["7372", "7373"],
        "naicsCodes": ["511210", "518210"],
        "keywords": ["project management", "workflow automation", "SaaS"]
      },
      "createdAt": "2026-02-24T07:00:00.000Z",
      "completedAt": "2026-02-24T07:15:00.000Z"
    }
  ]
}
```

---

### 4. Get Companies for a Search

**GET** `/api/v1/searches/:id/companies`

Retrieves all companies found in a specific search run.

**Path Parameters:**
- `id` (required): Search ID

**Query Parameters:**
- `limit` (optional, default: 50, max: 100): Number of companies per page
- `offset` (optional, default: 0): Number of companies to skip

**Example Request:**
```bash
curl -X GET "https://your-domain.manus.space/api/v1/searches/cm7search456/companies?limit=10" \
  -H "Authorization: Bearer cg-api-key-2026"
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "cm7abc123",
      "name": "Acme Corporation",
      "domain": "acme.com",
      "city": "San Francisco",
      "state": "California",
      "country": "United States",
      "industry": "Software",
      "employeeCount": 250,
      "revenue": 50000000,
      "linkedinUrl": "https://linkedin.com/company/acme",
      "searchId": "cm7search456",
      "createdAt": "2026-02-24T08:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Search not found"
}
```

---

## Data Model

### Company Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique company identifier |
| `name` | string | Company name |
| `domain` | string \| null | Company website domain |
| `city` | string \| null | City location |
| `state` | string \| null | State/province |
| `country` | string \| null | Country |
| `industry` | string \| null | Industry classification |
| `employeeCount` | number \| null | Number of employees |
| `revenue` | number \| null | Annual revenue (USD) |
| `linkedinUrl` | string \| null | LinkedIn company page URL |
| `twitterUrl` | string \| null | Twitter/X profile URL |
| `facebookUrl` | string \| null | Facebook page URL |
| `parentCompany` | string \| null | Parent company name |
| `subsidiaries` | string \| null | Comma-separated list of subsidiaries |
| `searchId` | string | ID of the search that found this company |
| `createdAt` | string | ISO 8601 timestamp |
| `briefData` | object \| null | Deep research brief (only in single company endpoint) |
| `salesApproachData` | object \| null | Sales approach materials (only in single company endpoint) |

### Search Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique search identifier |
| `url` | string | Website URL analyzed for offering extraction |
| `location` | string \| null | Geographic search filter |
| `status` | string | Search status: `offering_extraction`, `code_targeting`, `searching`, `completed`, `failed` |
| `offeringData` | object \| null | Extracted offering information |
| `codeTargetingData` | object \| null | SIC/NAICS codes and keywords |
| `createdAt` | string | ISO 8601 timestamp |
| `completedAt` | string \| null | ISO 8601 timestamp when search completed |

---

## Rate Limiting

Currently no rate limiting is enforced. For production use, consider implementing rate limiting based on your usage patterns.

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200 OK`: Successful request
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error responses include a JSON body with an `error` field describing the issue.

---

## Integration Examples

### Power Automate Flow

1. **Trigger:** Recurrence (e.g., daily at 9 AM)
2. **Action:** HTTP Request
   - Method: GET
   - URI: `https://your-domain.manus.space/api/v1/companies?limit=100`
   - Headers: `Authorization: Bearer cg-api-key-2026`
3. **Action:** Parse JSON (parse the response body)
4. **Action:** Apply to each company in `data` array
5. **Action:** Create or update record in Dataverse table

### Microsoft Dataverse Custom Connector

1. Create a new Custom Connector in Power Platform
2. Set the base URL to your Manus domain
3. Add Bearer token authentication
4. Import the OpenAPI specification (can be generated from this documentation)
5. Test the connection with the `/api/v1/companies` endpoint
6. Use the connector in Power Apps, Power Automate, or Logic Apps

---

## Security Considerations

1. **API Key Protection:** Never commit the API key to version control or expose it in client-side code
2. **HTTPS Only:** Always use HTTPS to encrypt API requests
3. **IP Whitelisting:** Consider implementing IP whitelisting for production deployments
4. **Key Rotation:** Regularly rotate the API key by updating the `API_KEY` environment variable
5. **Audit Logging:** Monitor API access logs for suspicious activity

---

## Support

For API issues or feature requests, contact the development team or submit an issue in the project repository.
