# AI Engineer OS MCP Remote Deployment Plan

**Date**: 2026-10-22
**Version**: v0.1.0
**Target**: Production deployment of remote MCP HTTP endpoint

## Overview

This plan outlines the deployment of the AI Engineer OS MCP remote HTTP endpoint to production. The endpoint exposes 9 public tools for curriculum browsing, lesson access, and project discovery. Private tools are blocked for security.

## Changes Summary

### New Files
- `src/app/api/mcp/route.ts` - Remote MCP HTTP endpoint (158 lines)
- `docs/MCP_CLIENT_CONFIG.md` - Client configuration examples (256 lines)
- `docs/MCP_SECURITY_REPORT.md` - Security verification report (269 lines)

### Modified Files
- `src/mcp/server.ts` - Updated resource read signature (1 line change)
- `src/mcp/types.ts` - Updated resource read signature (1 line change)
- `src/mcp/errors.ts` - Fixed import order (no functional change)
- `next.config.ts` - Added turbopack config (1 line change)
- `docs/MCP_GUIDE.md` - Updated with remote HTTP instructions (major update)
- `mcp-manifest.json` - Updated with new tools and resources
- `.claude/mcp.json` - Updated command (previous session)
- Deleted: `.cursorrules` (replaced with proper `.cursor/mcp.json` documentation)

### No Database Changes
- No migrations required
- No schema modifications
- No data imports
- Existing Neon database unchanged

## Deployment Steps

### Step 1: Review and Approve Changes
**Action Required**: User must review and approve the following:

1. **Code Changes**: Review the MCP endpoint implementation in `src/app/api/mcp/route.ts`
2. **Security Report**: Review `docs/MCP_SECURITY_REPORT.md` for security verification
3. **Client Config**: Review `docs/MCP_CLIENT_CONFIG.md` for client configuration examples
4. **Updated Docs**: Review updated `docs/MCP_GUIDE.md` for usage instructions

**Approval Required**: 
- [ ] Code changes reviewed
- [ ] Security report reviewed
- [ ] Client configuration reviewed
- [ ] Documentation reviewed
- [ ] **DEPLOYMENT APPROVED**

### Step 2: Commit Changes
**Action**: Commit all changes to git

```bash
cd "E:\AI ENGINEER"
git add -A
git commit -m "Add remote MCP HTTP endpoint with security measures"
```

**Expected Files to Commit**:
- `src/app/api/mcp/route.ts` (new)
- `src/mcp/server.ts` (modified)
- `src/mcp/types.ts` (modified)
- `src/mcp/errors.ts` (modified)
- `next.config.ts` (modified)
- `docs/MCP_GUIDE.md` (modified)
- `docs/MCP_CLIENT_CONFIG.md` (new)
- `docs/MCP_SECURITY_REPORT.md` (new)
- `mcp-manifest.json` (modified)

### Step 3: Push to GitHub
**Action**: Push committed changes to GitHub

```bash
git push origin main
```

**Repository**: `https://github.com/khrish11/AI-ENGINEER.git`
**Branch**: `main`

### Step 4: Deploy to Vercel
**Action Required**: Two options:

**Option A: Automatic Deployment (if GitHub connected)**
- If Vercel is connected to GitHub, deployment will trigger automatically
- Monitor deployment in Vercel dashboard

**Option B: Manual Deployment (if GitHub not connected)**
- Go to Vercel dashboard: https://vercel.com/girishs-projects-b67cdbb2/ai-engineer-os
- Click "Deployments"
- Click "Redeploy" or "New Deployment"
- Select the latest commit
- Deploy to **Production**

**Approval Required**: 
- [ ] **VERCEL DEPLOYMENT APPROVED**

### Step 5: Verify Deployment
**Action**: Verify the remote MCP endpoint is working

**Test URL**: `https://ai-engineer-os-inky.vercel.app/api/mcp`

**Test Commands**:
```bash
# Test initialization
curl -X POST https://ai-engineer-os-inky.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'

# Test public tool
curl -X POST https://ai-engineer-os-inky.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"get_all_phases","arguments":{}}}'

# Test private tool denial
curl -X POST https://ai-engineer-os-inky.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_current_week","arguments":{}}}'
```

**Expected Results**:
- Initialization: Returns protocol version and server info
- Public tool: Returns curriculum data
- Private tool: Returns `NOT_AUTHORIZED` error

### Step 6: Post-Deployment Verification
**Action**: Verify no regression in existing functionality

**Checks**:
- [ ] Web app loads at https://ai-engineer-os-inky.vercel.app
- [ ] Curriculum pages work
- [ ] Authentication still works
- [ ] Google OAuth still works
- [ ] No errors in Vercel logs
- [ ] MCP endpoint responds correctly

## Rollback Plan

If deployment causes issues:

1. **Immediate Rollback**:
   - Go to Vercel dashboard
   - Navigate to Deployments
   - Find the previous successful deployment
   - Click "Redeploy" on that deployment

2. **Rollback Verification**:
   - Verify web app works
   - Verify MCP endpoint is either gone or reverted

3. **Issue Investigation**:
   - Check Vercel logs for errors
   - Review security report for missed issues
   - Test locally with `npm run dev`

## Risk Assessment

### Low Risk
- **No database changes**: Deployment only adds a new API route
- **No breaking changes**: Existing functionality unchanged
- **Local stdio preserved**: Development workflow unchanged
- **Security measures**: Comprehensive security already implemented

### Medium Risk
- **Rate limiting**: In-memory rate limiting may need distributed implementation at scale
- **CORS configuration**: May need adjustment for specific client requirements

### Mitigation
- All security measures reviewed and tested
- Rollback plan documented
- Post-deployment verification steps defined

## Success Criteria

Deployment is successful when:

1. ✅ Remote MCP endpoint responds at `/api/mcp`
2. ✅ All 9 public tools work correctly
3. ✅ All 3 private tools are blocked
4. ✅ Rate limiting is enforced
5. ✅ Existing web app functionality is unchanged
6. ✅ No errors in Vercel logs
7. ✅ Security measures verified

## Exact Approval Required

**Before proceeding with deployment, the user must explicitly approve:**

1. **Code Review Approval**: 
   - "I have reviewed the code changes in `src/app/api/mcp/route.ts` and approve them."

2. **Security Approval**:
   - "I have reviewed the security report in `docs/MCP_SECURITY_REPORT.md` and approve the deployment."

3. **Deployment Approval**:
   - "I approve the deployment of the remote MCP endpoint to production."

**Do not proceed with deployment until all three approvals are received.**

## Post-Deployment Tasks

After successful deployment:

1. **Update README**: Add MCP endpoint information to main README
2. **Monitor Usage**: Check Vercel analytics for MCP endpoint usage
3. **Client Setup**: Configure clients (ChatGPT, Claude, Cursor, Codex) as needed
4. **Documentation**: Share `docs/MCP_CLIENT_CONFIG.md` with users

## Contact Information

For deployment issues:
- Check Vercel dashboard: https://vercel.com/girishs-projects-b67cdbb2/ai-engineer-os
- Review logs in Vercel
- Check security report: `docs/MCP_SECURITY_REPORT.md`
- Review client config: `docs/MCP_CLIENT_CONFIG.md`

## Appendix: Files Changed

### New Files
```
src/app/api/mcp/route.ts          158 lines  - Remote MCP HTTP endpoint
docs/MCP_CLIENT_CONFIG.md         256 lines  - Client configuration examples
docs/MCP_SECURITY_REPORT.md       269 lines  - Security verification report
```

### Modified Files
```
src/mcp/server.ts                  1 line    - Resource read signature
src/mcp/types.ts                   1 line    - Resource read signature
src/mcp/errors.ts                 1 line    - Import order fix
next.config.ts                     1 line    - Turbopack config
docs/MCP_GUIDE.md                 ~50 lines  - Remote HTTP instructions
mcp-manifest.json                 ~10 lines  - New tools/resources
```

### Deleted Files
```
.cursorrules                        - Replaced with proper config docs
```

**Total Lines Changed**: ~750 lines (excluding documentation)
