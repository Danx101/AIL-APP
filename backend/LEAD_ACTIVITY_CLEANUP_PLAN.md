# Lead Activity Cleanup - 1-Month Retention Plan

## 📋 Overview

This document outlines the implementation of automatic deletion of lead activities older than 1 month to optimize database performance while preserving all lead data permanently.

## 🎯 Goals

- **Performance**: 10x faster history queries (93ms → ~10ms)
- **Storage**: 90% reduction in activity data volume
- **User Experience**: Lightning-fast history loading
- **Data Safety**: Keep all leads permanent, only delete activity logs
- **Scalability**: Support 200+ concurrent users efficiently
- **Bug Fix**: Resolve User ID 16 empty history display issue

## 📊 Data Retention Policy

### 🗑️ AUTO-DELETED (after 1 month)
- **Lead activity logs** (`lead_activities` table)
  - Status change history
  - Call logs 
  - Notes history
  - Import/export logs
  - All activities older than 30 days

### ✅ PERMANENTLY PRESERVED
- **All leads** (active + archived in `leads` table)
- **Lead contact information** (name, phone, email)
- **Current lead status** and notes
- **All appointments** (`appointments` table)
- **All customers** (`customers` table) 
- **All other business data**

## 🛠️ Technical Implementation

### Step 1: Database Cleanup Job
**File**: `backend/src/jobs/cleanup-activities.js`

**Core Logic**:
```sql
DELETE FROM lead_activities 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 MONTH);
```

**Features**:
- Dry-run mode for testing
- Detailed logging of deleted records
- Error handling and rollback
- Performance metrics tracking

### Step 2: Scheduled Execution
**Schedule**: Daily at 2:00 AM UTC
**Implementation**: Node.js cron job

**Monitoring**:
- Execution logs
- Performance metrics
- Error alerts
- Success/failure notifications

### Step 3: Database Optimization
**Index Creation**:
```sql
CREATE INDEX idx_activities_studio_date 
ON lead_activities(studio_id, created_at DESC);
```

**Query Optimization**:
- Composite indexes for date-range queries
- Optimized pagination
- Reduced JOIN complexity

### Step 4: API Updates
**History Endpoint**: `/api/v1/leads/studio/:studioId/history`

**Changes**:
- Add "Last 30 days" to response metadata
- Include cleanup status information
- Performance metrics in response headers

### Step 5: Frontend Updates & Bug Fix
**Lead Kanban History View**:
- Update title: "Lead History (Last 30 Days)"
- Modify empty state messaging
- Add performance indicators
- Update export functionality

**User ID 16 Bug Fix**:
- Add frontend debugging tools for network requests
- Implement JWT token validation checks
- Add JavaScript error handling and logging
- Clear browser cache issues
- Add API connectivity diagnostics

## 🚀 Expected Performance Improvements

### Current Performance
- **Records per studio**: ~102 activities
- **Query time**: 93ms for complex history query
- **Database size**: Growing continuously
- **User experience**: Acceptable but declining

### After Implementation
- **Records per studio**: ~8-12 activities (90% reduction)
- **Query time**: ~5-10ms (10x improvement)
- **Database size**: Stable and optimized
- **User experience**: Lightning-fast loading

## 📈 Scalability Benefits

### Database Load
- **Before**: Linear growth with time
- **After**: Constant, manageable size

### Connection Pool Usage
- **Before**: Longer queries = more connections held
- **After**: Fast queries = efficient connection usage

### User Capacity
- **Before**: Performance degrades with more users
- **After**: Consistent performance for 200+ users

## 🔒 Data Safety Measures

### Backup Strategy
- Full database backup before initial cleanup
- Regular incremental backups
- Point-in-time recovery capability

### Testing Protocol
1. **Development testing** with sample data
2. **Staging validation** with production-like data
3. **Gradual rollout** with monitoring
4. **Rollback plan** if issues arise

### Compliance Considerations
- **GDPR**: Automatic data retention compliance
- **Business needs**: Lead data preserved indefinitely
- **Audit trail**: Cleanup operations logged

## 🔍 User ID 16 History Issue Analysis

### Investigation Results
**✅ Backend API Status**: Working correctly
- User 16 (Danylo Gevel) owns studio ID 5 (AIL Wien)
- Studio 5 has 102 activities in database
- API returns 10 activities per page correctly for user 16
- History endpoint `/api/v1/leads/studio/5/history` responds with valid data

### Root Cause
**❌ Frontend Issue**: API data not displaying to user
**Not a backend problem** - the data exists and API works

### Possible Causes
1. **Authorization Token Issues**:
   - Expired/invalid JWT token
   - Token not being sent with requests
   - CORS blocking authenticated requests

2. **Network/API Call Issues**:
   - API calls failing silently
   - Network timeouts
   - Incorrect API endpoint URLs

3. **JavaScript Errors**:
   - Frontend code breaking before rendering
   - Console errors preventing history display
   - React/JavaScript exceptions

4. **Browser Cache Issues**:
   - Browser caching empty responses
   - Stale cached API responses
   - ServiceWorker interference

### Debug Action Plan
1. **Check browser developer tools**:
   - Network tab for failed API calls
   - Console tab for JavaScript errors
   - Application tab for token issues

2. **Verify API connectivity**:
   - Test history endpoint directly in browser
   - Validate JWT token in localStorage
   - Check for CORS errors

3. **Clear cache and test**:
   - Hard refresh (Ctrl+Shift+R)
   - Clear browser cache/localStorage
   - Test in incognito mode

## 📁 Implementation Files

### New Files to Create
1. `backend/src/jobs/cleanup-activities.js` - Main cleanup job
2. `backend/src/jobs/job-scheduler.js` - Cron job scheduler
3. `backend/src/utils/performance-monitor.js` - Performance tracking
4. `frontend/public/src/utils/debug-tools.js` - Frontend debugging utilities
5. Database migration for index optimization

### Files to Modify
1. `backend/src/controllers/leadController.js` - API messaging updates
2. `frontend/public/src/components/studio/LeadKanban.js` - UI updates + debugging
3. `backend/package.json` - Add cleanup scripts
4. `backend/.env` - Add cleanup configuration
5. `frontend/public/src/services/managerAPI.js` - Add error handling

## 🎛️ Configuration Options

### Environment Variables
```bash
# Cleanup job configuration
CLEANUP_ENABLED=true
CLEANUP_RETENTION_DAYS=30
CLEANUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM
CLEANUP_DRY_RUN=false
CLEANUP_BATCH_SIZE=1000

# Performance monitoring
PERFORMANCE_MONITORING=true
SLOW_QUERY_THRESHOLD=100
```

### Runtime Configuration
- Enable/disable cleanup via admin panel
- Adjust retention period (default: 30 days)
- Configure cleanup schedule
- Performance monitoring settings

## 📊 Monitoring & Alerting

### Key Metrics
- **Cleanup execution time**
- **Records deleted per run**
- **Query performance improvements**
- **Database size changes**
- **Error rates**

### Alerting Conditions
- Cleanup job failures
- Unusually high deletion counts
- Performance regression
- Database connection issues

## 🧪 Testing Strategy

### Pre-Production Testing
1. **Unit tests** for cleanup logic
2. **Integration tests** for full workflow
3. **Performance tests** with large datasets
4. **User acceptance testing** for UI changes

### Production Validation
1. **Gradual rollout** starting with test studios
2. **A/B testing** for performance comparison
3. **User feedback** collection
4. **Performance monitoring** and optimization

## 📋 Implementation Checklist

### Database Cleanup Features
- [ ] Create cleanup job script
- [ ] Add database index optimization
- [ ] Implement job scheduling
- [ ] Update API endpoints
- [ ] Add configuration options
- [ ] Implement monitoring
- [ ] Create test suite

### User ID 16 Bug Fix
- [ ] Add frontend debugging utilities
- [ ] Implement JWT token validation
- [ ] Add API connectivity diagnostics
- [ ] Test browser cache clearing
- [ ] Add error handling to history loading
- [ ] Create user-specific debug mode

### General Tasks
- [ ] Modify frontend components
- [ ] Document deployment process
- [ ] Plan rollback strategy
- [ ] User acceptance testing

## 🚀 Deployment Plan

### Phase 1: Infrastructure
- Deploy cleanup job (disabled)
- Add database indexes
- Update configuration

### Phase 2: Testing
- Enable cleanup in dry-run mode
- Monitor performance improvements
- Validate data integrity

### Phase 3: Production Rollout
- Enable cleanup for test studios
- Monitor and adjust
- Full rollout to all studios

### Phase 4: Optimization
- Fine-tune performance
- Adjust retention policies
- Optimize based on usage patterns

## 📞 Support & Maintenance

### Regular Maintenance
- **Weekly**: Review cleanup logs
- **Monthly**: Performance analysis
- **Quarterly**: Retention policy review
- **Annually**: Full system optimization

### Emergency Procedures
- Cleanup job failure response
- Data recovery procedures
- Performance degradation handling
- Rollback to previous state

---

**Document Version**: 1.0  
**Created**: August 18, 2025  
**Last Updated**: August 18, 2025  
**Owner**: Development Team