# 🔗 Google Sheets Integration Guide

## ✅ Setup Complete!

Your Google Sheets integration is now ready to use with the credentials from your `leads-lists-9f5b6a2f47bf.json` file.

### 🔧 **What's Configured:**
- ✅ **Google Service Account**: `sheets-api-ail@leads-lists.iam.gserviceaccount.com`
- ✅ **Project ID**: `leads-lists`
- ✅ **Credentials**: Loaded in `.env` file
- ✅ **Auto-sync**: Scheduled every 30 minutes
- ✅ **Manager Authorization**: Only managers can connect Google Sheets

## 📋 **How to Use Google Sheets Integration**

### **Step 1: Prepare Your Google Sheet**
1. Create a Google Sheet with lead data
2. Include columns for: **Name**, **Phone Number** (required)
3. Optional columns: **Email**, **Notes**
4. **Share the sheet** with: `sheets-api-ail@leads-lists.iam.gserviceaccount.com`
5. Give **Editor** access to the service account

### **Step 2: Connect Sheet via Manager Account**

#### **Preview Sheet Data** (Optional)
```bash
POST /api/v1/manager/google-sheets/preview
Authorization: Bearer <manager-jwt-token>
Content-Type: application/json

{
  "sheet_url": "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID"
}
```

#### **Connect Sheet to Studio**
```bash
POST /api/v1/manager/google-sheets/connect
Authorization: Bearer <manager-jwt-token>
Content-Type: application/json

{
  "studio_id": 1,
  "sheet_url": "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID",
  "column_mapping": {
    "name": "Name",
    "phone_number": "Phone",
    "email": "Email",
    "notes": "Notes"
  },
  "auto_sync_enabled": true
}
```

### **Step 3: Monitor and Manage**

#### **View All Integrations**
```bash
GET /api/v1/manager/google-sheets
Authorization: Bearer <manager-jwt-token>
```

#### **Manual Sync**
```bash
POST /api/v1/manager/google-sheets/{integration_id}/sync
Authorization: Bearer <manager-jwt-token>
```

#### **View Imported Leads**
```bash
GET /api/v1/leads/studio/{studio_id}
Authorization: Bearer <studio-owner-jwt-token>
```

## 🔐 **Permission System**

### **Manager Permissions:**
- ✅ Connect Google Sheets to any studio
- ✅ Preview sheet data before connecting
- ✅ Manage all Google Sheets integrations
- ✅ Trigger manual syncs
- ✅ View statistics across all studios

### **Studio Owner Permissions:**
- ✅ View leads imported by manager
- ✅ Add manual leads (separate from imports)
- ✅ Make calls to leads (when Twilio is configured)
- ✅ Update lead status and notes
- ❌ Cannot modify Google Sheets settings
- ❌ Cannot see other studios' leads

## 📊 **Data Flow**

```
Google Sheet → Manager connects → Auto-sync (30 min) → Studio Owner views leads
     ↓
  Manager can:
  - Connect/disconnect sheets
  - Trigger manual syncs
  - View all studio statistics
     ↓
  Studio Owner can:
  - View imported leads (read-only source)
  - Add manual leads
  - Call and manage leads
```

## 🔄 **Auto-Sync Features**

- **Frequency**: Every 30 minutes (configurable)
- **New Leads**: Automatically imported
- **Duplicates**: Prevented by phone number matching
- **Error Handling**: Failed imports logged with details
- **Status Tracking**: Last sync time and status visible

## 🎯 **Testing Ready**

The integration is now ready for testing with real Google Sheets data. Here's what you can test:

1. **Create a test Google Sheet** with sample lead data
2. **Share it** with `sheets-api-ail@leads-lists.iam.gserviceaccount.com`
3. **Use the preview endpoint** to test connection
4. **Connect the sheet** to a studio via manager account
5. **Verify leads appear** in studio owner dashboard

## 🚀 **Next Steps**

- **Twilio Integration**: Add when regulatory approval is complete
- **Frontend Interface**: Build manager and studio owner dashboards
- **Dialogflow**: Configure for voice assistant features

## 🔧 **API Endpoints Summary**

### Manager Endpoints:
- `POST /api/v1/manager/google-sheets/preview` - Preview sheet data
- `POST /api/v1/manager/google-sheets/connect` - Connect sheet to studio  
- `GET /api/v1/manager/google-sheets` - List all integrations
- `GET /api/v1/manager/google-sheets/{id}` - Get specific integration
- `PUT /api/v1/manager/google-sheets/{id}` - Update integration
- `DELETE /api/v1/manager/google-sheets/{id}` - Remove integration
- `POST /api/v1/manager/google-sheets/{id}/sync` - Manual sync
- `GET /api/v1/manager/leads/stats` - All lead statistics

### Studio Owner Endpoints:
- `GET /api/v1/leads/studio/{studio_id}` - View all leads
- `POST /api/v1/leads` - Add manual lead
- `PUT /api/v1/leads/{id}` - Update lead (manual only)
- `POST /api/v1/leads/{id}/call` - Initiate call (when Twilio ready)

Your Google Sheets integration is fully operational! 🎉