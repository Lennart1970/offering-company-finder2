# Microsoft Copilot Prompt for Dataverse Integration

Copy and paste this prompt into Microsoft Copilot (Copilot Studio or Power Automate) to set up automatic data synchronization from the offering-company-finder REST API to Microsoft Dataverse.

---

## Prompt for Copilot

```
I need help setting up a Power Automate flow that synchronizes company data from a REST API into Microsoft Dataverse. Here are the details:

**REST API Details:**
- Base URL: https://YOUR-DOMAIN.manus.space/api/v1
- Authentication: Bearer token (API Key: cg-api-key-2026)
- Main endpoint: GET /api/v1/companies?limit=100&offset=0

**API Response Structure:**
The API returns JSON with this structure:
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "domain": "string",
      "city": "string",
      "state": "string",
      "country": "string",
      "industry": "string",
      "employeeCount": number,
      "revenue": number,
      "linkedinUrl": "string",
      "twitterUrl": "string",
      "facebookUrl": "string",
      "parentCompany": "string",
      "subsidiaries": "string",
      "searchId": "string",
      "createdAt": "string"
    }
  ],
  "pagination": {
    "total": number,
    "limit": number,
    "offset": number,
    "hasMore": boolean
  }
}

**Requirements:**
1. Create a Dataverse table called "Companies" with columns matching the API response fields
2. Set up a scheduled Power Automate flow that runs daily at 9 AM
3. The flow should:
   - Call the REST API with pagination (fetch 100 companies at a time)
   - Loop through all pages until hasMore is false
   - For each company, check if it already exists in Dataverse (using the "id" field as the unique key)
   - If the company exists, update the record
   - If the company doesn't exist, create a new record
4. Add error handling to log any failed API calls or database operations
5. Send an email notification when the sync completes with a summary (total companies synced, new records created, records updated, errors)

**Additional Context:**
- The API is stable and returns consistent data
- Company IDs are unique and never change
- Some fields may be null (city, state, revenue, etc.)
- The createdAt field is an ISO 8601 timestamp
- Revenue is in USD
- Parent company and subsidiaries are comma-separated text fields

Please provide step-by-step instructions for:
1. Creating the Dataverse table with the correct column types
2. Setting up the Power Automate flow with all necessary actions
3. Configuring the HTTP request with Bearer token authentication
4. Implementing pagination logic to fetch all companies
5. Setting up the upsert logic (create or update based on ID)
6. Adding error handling and notification

If possible, provide screenshots or a visual flow diagram showing how the actions connect together.
```

---

## Alternative: Custom Connector Approach

If you prefer to create a reusable Custom Connector instead of a one-off flow, use this prompt:

```
I need help creating a Custom Connector in Power Platform to connect to a REST API for company data. Here are the details:

**API Details:**
- Base URL: https://YOUR-DOMAIN.manus.space
- Authentication: API Key (Bearer token in Authorization header)
- Endpoints:
  1. GET /api/v1/companies - List all companies (supports limit and offset query parameters)
  2. GET /api/v1/companies/{id} - Get single company with detailed information
  3. GET /api/v1/searches - List all search runs
  4. GET /api/v1/searches/{id}/companies - Get companies for a specific search

**Authentication:**
- Type: API Key
- Header name: Authorization
- Header value format: Bearer {API_KEY}
- My API key: cg-api-key-2026

**Request:**
1. Guide me through creating a Custom Connector in Power Platform
2. Help me configure the security settings for Bearer token authentication
3. Show me how to define each endpoint with the correct parameters
4. Explain how to test the connector to verify it works
5. Demonstrate how to use this connector in a Power Automate flow to sync data to Dataverse

Please provide detailed step-by-step instructions with screenshots if possible.
```

---

## Post-Setup Validation

After setting up the integration, verify it works correctly:

1. **Test the API connection:**
   - Use the "Test" button in Power Automate to verify the HTTP request returns data
   - Check that the Bearer token authentication is working (should return 200 OK, not 401 Unauthorized)

2. **Verify Dataverse table:**
   - Check that the Companies table was created with all required columns
   - Verify column types match the data types from the API (text, number, date, etc.)
   - Ensure the "id" column is set as the primary key or alternate key

3. **Run the flow manually:**
   - Trigger the flow manually before scheduling it
   - Check the flow run history for errors
   - Verify that companies appear in the Dataverse table
   - Confirm that running the flow again updates existing records instead of creating duplicates

4. **Monitor scheduled runs:**
   - After scheduling, check the flow run history daily for the first week
   - Review the email notifications to ensure sync is working
   - Investigate any errors and adjust the flow as needed

---

## Troubleshooting Common Issues

### Issue: 401 Unauthorized Error

**Solution:** Verify the Bearer token format in the Authorization header:
- Correct: `Authorization: Bearer cg-api-key-2026`
- Incorrect: `Authorization: cg-api-key-2026` (missing "Bearer" prefix)

### Issue: Pagination Not Working

**Solution:** Ensure the flow loops correctly:
1. Initialize a variable `offset` with value 0
2. Use a "Do until" loop with condition: `hasMore equals false`
3. Inside the loop, increment `offset` by `limit` after each API call
4. Pass the updated `offset` value to the next API request

### Issue: Duplicate Records in Dataverse

**Solution:** Use the "Upsert" action instead of "Create":
1. In the Dataverse action, select "Upsert a row"
2. Set the alternate key to the "id" field from the API
3. This will automatically update existing records or create new ones

### Issue: Null Values Causing Errors

**Solution:** Add null checks before creating/updating records:
1. Use the "Condition" action to check if a field is null
2. If null, use a default value or skip the field
3. Example: `if(empty(item()?['city']), 'Unknown', item()?['city'])`

---

## Advanced: Syncing Deep Research Data

To also sync the detailed deep research briefs and sales approaches, modify the flow:

1. After syncing basic company data, add a second HTTP request:
   - Method: GET
   - URI: `https://YOUR-DOMAIN.manus.space/api/v1/companies/{companyId}`
   - This returns `briefData` and `salesApproachData` objects

2. Create additional Dataverse tables:
   - **DeepResearchBriefs** table with columns: companyId, urgencyScore, urgencyReasoning, companyIntelligence, recentDevelopments (JSON), verifiedSources (JSON)
   - **SalesApproaches** table with columns: companyId, conversationStarters (JSON), emailTemplate, linkedinMessage, callScript

3. Parse the nested JSON objects and store them in the respective tables

4. Link the tables using the companyId as a foreign key

This allows you to access the full deep research and sales approach data from within Dataverse for use in Power Apps or custom reports.

---

## Cost Considerations

**Power Automate:**
- Standard plan: 5,000 runs/month included
- Premium plan: Unlimited runs with Dataverse connector
- Estimate: 1 run/day × 30 days = 30 runs/month (well within limits)

**Dataverse:**
- Storage: Each company record ~2 KB, 1,000 companies = ~2 MB (minimal cost)
- API calls: 1 call per company for basic sync, additional calls for deep research data

**Recommendation:** Start with the basic company sync (single API call per day) and add deep research sync only if needed.

---

## Next Steps

1. Replace `YOUR-DOMAIN` in the prompts above with your actual Manus domain
2. Copy the appropriate prompt (Flow or Custom Connector) into Microsoft Copilot
3. Follow the step-by-step instructions provided by Copilot
4. Test the integration thoroughly before scheduling it
5. Monitor the first few scheduled runs to ensure stability
6. Consider adding deep research sync after the basic sync is working reliably

For additional help, refer to the full REST API documentation in `REST_API_DOCS.md`.
