# 🧪 QA Test Plan — Petro Valve Workflow Automation
> **Version**: 1.0  
> **Date**: 2026-05-13  
> **Prepared For**: QA Tester  
> **Application**: Petro Valve Workflow Automation Platform (Phase 1)

---

## 📋 Pre-Requisites

| Item | Details |
|---|---|
| **Frontend URL** | `http://localhost:5173` (dev) or production Vercel URL |
| **Backend URL** | `http://localhost:5000` (dev) or production Render URL |
| **Browser** | Chrome 120+, Firefox 115+, or Edge 120+ |
| **Screen Resolution** | Minimum 1280×720, test at 1920×1080 |

### Test Credentials

| Role | Email | Password | Access Level |
|---|---|---|---|
| Super Admin (SA) | `admin@petrovalve.com` | `adminpassword123` | Full system access |

> **Note**: After logging in as Super Admin, create additional test users (Director, Sales, QC, etc.) via Admin → Users page to test RBAC.

---

## 🔐 TEST SUITE 1: Authentication & Access Control

### TC-1.1: Login with valid credentials
- **Steps**:
  1. Navigate to `/login`
  2. Enter email: `admin@petrovalve.com`
  3. Enter password: `adminpassword123`
  4. Click "Sign In"
- **Expected**: Redirect to `/app/dashboard`. Username visible in sidebar/header.
- **Result**: ☐ Pass ☐ Fail

### TC-1.2: Login with invalid password
- **Steps**:
  1. Navigate to `/login`
  2. Enter email: `admin@petrovalve.com`
  3. Enter password: `WrongPassword`
  4. Click "Sign In"
- **Expected**: Error message "Invalid credentials" displayed. No redirect.
- **Result**: ☐ Pass ☐ Fail

### TC-1.3: Login with non-existent user
- **Steps**:
  1. Enter email: `nonexistent@test.com`
  2. Enter any password
  3. Click "Sign In"
- **Expected**: Error message displayed. No redirect.
- **Result**: ☐ Pass ☐ Fail

### TC-1.4: Session persistence
- **Steps**:
  1. Login successfully
  2. Close browser tab
  3. Open new tab, navigate to app URL
- **Expected**: User is still logged in (JWT token persisted).
- **Result**: ☐ Pass ☐ Fail

### TC-1.5: Logout
- **Steps**:
  1. Login successfully
  2. Click Logout button
- **Expected**: Redirect to `/login`. Protected routes are inaccessible.
- **Result**: ☐ Pass ☐ Fail

### TC-1.6: Protected route access without login
- **Steps**:
  1. Clear browser storage/cookies
  2. Navigate directly to `/app/dashboard`
- **Expected**: Redirect to `/login`.
- **Result**: ☐ Pass ☐ Fail

---

## 👤 TEST SUITE 2: User Management (Admin → Users)

### TC-2.1: View users list
- **Steps**:
  1. Login as Super Admin
  2. Navigate to Admin → Users
- **Expected**: Table shows all users with columns: Name (with USR-NNNN ID), Role, Department, Status, Actions.
- **Result**: ☐ Pass ☐ Fail

### TC-2.2: Create new user
- **Steps**:
  1. Click "Create User" button
  2. Fill: Name = "Test Sales User", Mobile = "9876543210", Role = "Sales Executive (SALES)"
  3. Submit
- **Expected**: User created. Success message shown. New user appears in list with auto-generated `USR-NNNN` ID.
- **Result**: ☐ Pass ☐ Fail

### TC-2.3: Duplicate mobile number rejection
- **Steps**:
  1. Try creating another user with mobile `9876543210`
- **Expected**: Error: "User with this mobile number already exists"
- **Result**: ☐ Pass ☐ Fail

### TC-2.4: Edit user — all fields
- **Steps**:
  1. Click "Edit" on any user
  2. Verify modal shows: User ID (read-only), Full Name, Display Name, Email, Login Method, System Role, Secondary Role, Department
  3. Change Display Name to "Test"
  4. Change Login Method to "OTP (Mobile)"
  5. Save
- **Expected**: All fields editable. Changes persist after refresh.
- **Result**: ☐ Pass ☐ Fail

### TC-2.5: Deactivate user
- **Steps**:
  1. Click "Deactivate" on a non-admin user
  2. Confirm
- **Expected**: User status changes to inactive. Badge shows accordingly.
- **Result**: ☐ Pass ☐ Fail

### TC-2.6: Password reset
- **Steps**:
  1. Click "Reset" on a user
  2. Confirm action
- **Expected**: Password reset token generated. Success message shown.
- **Result**: ☐ Pass ☐ Fail

---

## 🏢 TEST SUITE 3: Customer Master

### TC-3.1: Create customer — minimum fields
- **Steps**:
  1. Navigate to Customers
  2. Click "Add Customer"
  3. Fill required fields only: Company Name, Primary Contact Name, Mobile Number
  4. Submit
- **Expected**: Customer created with auto-generated `CUS-XXXX` ID. Appears in list.
- **Result**: ☐ Pass ☐ Fail

### TC-3.2: Create customer — all SOW fields
- **Steps**:
  1. Click "Add Customer"
  2. Fill ALL fields:
     - **Company Info**: Company Name, Customer Type (Private), Source Channel (IndiaMart)
     - **Contact**: Primary Contact, Designation, Mobile, Alternate Mobile, Email, Alternate Email
     - **Address & Tax**: City, State (select "Maharashtra" from dropdown), Country, GSTIN (15 chars), PAN (10 chars)
     - **Commercial**: Payment Terms (30 days), Credit Limit (500000)
     - **Tags & Notes**: Add tags "Hot" + "Strategic", Internal Notes
  3. Submit
- **Expected**: All fields saved. Verify each field shows correctly when editing.
- **Result**: ☐ Pass ☐ Fail

### TC-3.3: GSTIN validation
- **Steps**:
  1. Enter GSTIN with lowercase letters
- **Expected**: Auto-converted to uppercase. Max 15 characters enforced.
- **Result**: ☐ Pass ☐ Fail

### TC-3.4: State dropdown
- **Steps**:
  1. Click State dropdown in customer form
  2. Type "Maha"
- **Expected**: Dropdown filters to show "Maharashtra". All 28 states + 8 UTs available.
- **Result**: ☐ Pass ☐ Fail

### TC-3.5: Tags multi-select
- **Steps**:
  1. Select tag "Hot"
  2. Select tag "Strategic"
  3. Remove tag "Hot" by clicking ×
- **Expected**: Tags appear as chips. Removable individually. Saved correctly.
- **Result**: ☐ Pass ☐ Fail

### TC-3.6: Edit existing customer
- **Steps**:
  1. Click edit on an existing customer
  2. Verify all fields are pre-populated (including Source Channel, Tags, Notes, Credit Limit)
  3. Change Credit Limit to 1000000
  4. Save
- **Expected**: Updated value persists after refresh.
- **Result**: ☐ Pass ☐ Fail

### TC-3.7: Soft delete (deactivate)
- **Steps**:
  1. Uncheck "Account is Active" checkbox
  2. Save
- **Expected**: Customer marked inactive. Still visible in list but with inactive indicator.
- **Result**: ☐ Pass ☐ Fail

### TC-3.8: Search customers
- **Steps**:
  1. Type company name in search bar
- **Expected**: List filters in real-time. Matching customers shown.
- **Result**: ☐ Pass ☐ Fail

---

## ⚙️ TEST SUITE 4: System Settings

### TC-4.1: Company Profile tab
- **Steps**:
  1. Navigate to System Settings
  2. Click "Company Profile" tab
  3. Verify fields: Company Name, GSTIN, PAN, Registered Address, Logo upload
  4. Update Company Name
  5. Save
- **Expected**: Changes saved. Success toast shown.
- **Result**: ☐ Pass ☐ Fail

### TC-4.2: Email & WhatsApp tab
- **Steps**:
  1. Click "Email & WhatsApp" tab
  2. Verify SMTP fields: Host, Port, User, Password
  3. Verify WhatsApp API fields
- **Expected**: All configuration fields present and editable.
- **Result**: ☐ Pass ☐ Fail

### TC-4.3: Notification Rules tab
- **Steps**:
  1. Click "Notification Rules" tab
  2. Verify configurable values: Quotation Validity (days), Follow-up Reminder (days), Escalation (days), Abandon Threshold (days)
  3. Change Follow-up Reminder to 3
  4. Save
- **Expected**: Value saved. Used by cron scheduler.
- **Result**: ☐ Pass ☐ Fail

### TC-4.4: Operations & Banks tab
- **Steps**:
  1. Click "Operations & Banks" tab
  2. Verify: Bank Name, Account Number, IFSC, UPI ID, GST Rate
  3. Fill bank details
  4. Save
- **Expected**: Bank details saved. Will be used in quotation PDFs.
- **Result**: ☐ Pass ☐ Fail

---

## 📝 TEST SUITE 5: Enquiry Management

### TC-5.1: Create enquiry — Email source
- **Steps**:
  1. Navigate to Enquiries
  2. Click "New Enquiry"
  3. Fill Customer Details: Company Name, Contact Person, Mobile
  4. Set Source Channel = "Email"
  5. Verify "Received On" email account dropdown appears (info@, sales@, support@)
  6. Fill Product: Category = "Pressure Vessel", Description, Quantity = 5, Unit = NOS
  7. Set Priority = "Medium"
  8. Fill Estimated Value = 500000
  9. Fill Internal Notes = "Test note"
  10. Submit
- **Expected**: Enquiry created with sequential ID `ENQ-2026-05-NNNN`. Redirects/shows in list.
- **Result**: ☐ Pass ☐ Fail

### TC-5.2: Create enquiry — IndiaMart source (conditional fields)
- **Steps**:
  1. Click "New Enquiry"
  2. Set Source Channel = "IndiaMart"
  3. Verify orange IndiaMart panel appears with: IndiaMart Lead ID (required), Lead Genuineness, Contact Method, Details Shared checkbox
  4. Fill Lead ID = "12345678"
  5. Set Genuineness = "Genuine"
  6. Complete remaining fields and submit
- **Expected**: IndiaMart-specific fields saved. Visible on detail page. "Days Since Lead" calculated.
- **Result**: ☐ Pass ☐ Fail

### TC-5.3: Create enquiry — GEM Portal source
- **Steps**:
  1. Set Source Channel = "GEM Portal"
  2. Verify "Tender No" field appears (required)
  3. Fill tender number and submit
- **Expected**: GEM Tender No saved and visible.
- **Result**: ☐ Pass ☐ Fail

### TC-5.4: Create enquiry — Exhibition source
- **Steps**:
  1. Set Source Channel = "Exhibition"
  2. Verify "Exhibition Name" field appears (required)
  3. Fill exhibition name and submit
- **Expected**: Exhibition name saved.
- **Result**: ☐ Pass ☐ Fail

### TC-5.5: Enquiry ID format verification
- **Steps**:
  1. Create 3 enquiries in the same month
  2. Check their IDs
- **Expected**: Sequential format: `ENQ-2026-05-0001`, `ENQ-2026-05-0002`, `ENQ-2026-05-0003`. No gaps, no random numbers.
- **Result**: ☐ Pass ☐ Fail

### TC-5.6: Status workflow
- **Steps**:
  1. Open an enquiry detail page
  2. Click the status badge dropdown
  3. Verify all 9 statuses are available: New, Contacted, Technical Review, Quoted, Negotiating, Won, Lost, On Hold, Abandoned
  4. Change status from "New" to "Contacted"
- **Expected**: Status updates. Toast confirms. Badge color changes.
- **Result**: ☐ Pass ☐ Fail

### TC-5.7: Priority change
- **Steps**:
  1. On enquiry detail, click priority badge
  2. Change from "Medium" to "Urgent"
- **Expected**: Priority updates. If "Urgent", Director + Sales should receive notification (check notification bell).
- **Result**: ☐ Pass ☐ Fail

### TC-5.8: Lost reason enforcement
- **Steps**:
  1. Change enquiry status to "Lost"
- **Expected**: Lost Reason dropdown should be required. Director + Sales Head receive notification.
- **Result**: ☐ Pass ☐ Fail

### TC-5.9: Edit enquiry via modal
- **Steps**:
  1. On enquiry list, hover over a row
  2. Click pencil (Edit) icon
  3. Change Product Description
  4. Save
- **Expected**: Changes saved. List refreshes with updated data.
- **Result**: ☐ Pass ☐ Fail

### TC-5.10: Edit enquiry via detail page
- **Steps**:
  1. Click into an enquiry detail
  2. Click "Edit" button
  3. Modify fields (Standard/Code, Budget, Delivery Weeks)
  4. Save
- **Expected**: All edited fields persist. Internal Notes and Estimated Value editable.
- **Result**: ☐ Pass ☐ Fail

### TC-5.11: Filter enquiries by status
- **Steps**:
  1. On enquiries list, click "Filter"
  2. Select Status = "New"
- **Expected**: Only "New" enquiries shown. Clear filter restores full list.
- **Result**: ☐ Pass ☐ Fail

### TC-5.12: Filter enquiries by product category
- **Steps**:
  1. Select Category = "Pressure Vessel"
- **Expected**: Only Pressure Vessel enquiries shown.
- **Result**: ☐ Pass ☐ Fail

### TC-5.13: Export to CSV
- **Steps**:
  1. Click "Export" button
- **Expected**: CSV file downloads with all visible enquiry data.
- **Result**: ☐ Pass ☐ Fail

### TC-5.14: Assign enquiry to user
- **Steps**:
  1. On enquiry detail, use the "Assign" dropdown
  2. Select a different user
- **Expected**: Assignment changes. That user receives a notification.
- **Result**: ☐ Pass ☐ Fail

### TC-5.15: Delete/archive enquiry
- **Steps**:
  1. On enquiry detail (as SA/Director), click "Archive"
  2. Confirm
- **Expected**: Enquiry deleted. Redirects to list. Audit log entry created.
- **Result**: ☐ Pass ☐ Fail

---

## 🔧 TEST SUITE 6: Dynamic Fields (ASME)

### TC-6.1: ASME fields appear conditionally
- **Steps**:
  1. Create/edit an enquiry
  2. Set Product Category = "Pressure Vessel"
  3. Set Standard/Code = "ASME"
  4. Scroll to "Technical Specifications" section
- **Expected**: ASME fields appear: ASME Section, Design Code Edition, Design Pressure (MPa), Design Temperature (°C), Operating Pressure, Operating Temperature, Radiography Required, PWHT Required, Material Test Certificate, Hardness Test, Impact Test, Hydrostatic Test Pressure, PMI Required, Applicable Addenda.
- **Result**: ☐ Pass ☐ Fail

### TC-6.2: ASME fields hidden when standard ≠ ASME
- **Steps**:
  1. Change Standard/Code to "IS"
- **Expected**: ASME-specific fields disappear. No errors.
- **Result**: ☐ Pass ☐ Fail

### TC-6.3: ASME field values saved
- **Steps**:
  1. Set Standard = "ASME"
  2. Fill: ASME Section = "Section VIII Div 1", Design Pressure = 15.5, Design Temperature = 350
  3. Save enquiry
  4. Reopen enquiry
- **Expected**: All ASME field values persisted and displayed.
- **Result**: ☐ Pass ☐ Fail

### TC-6.4: Field Builder (Admin)
- **Steps**:
  1. Navigate to Admin → Field Builder
  2. Verify ASME fields are listed under "Enquiry" context
  3. Try adding a new custom field
- **Expected**: All 15 ASME fields visible. New fields can be added with type, label, options, conditional logic.
- **Result**: ☐ Pass ☐ Fail

---

## 📞 TEST SUITE 7: Follow-Up Engine

### TC-7.1: Add follow-up to enquiry
- **Steps**:
  1. Open any enquiry detail
  2. Find the Follow-up panel
  3. Add: Type = "Call", Notes = "Discussed pricing", Next Follow-up Date = tomorrow
  4. Submit
- **Expected**: Follow-up appears in timeline. Enquiry's "Next Follow-up" date updates.
- **Result**: ☐ Pass ☐ Fail

### TC-7.2: Follow-up types
- **Steps**:
  1. Add follow-ups of each type: Call, Email, Meeting, Site Visit, WhatsApp, Note
- **Expected**: Each type has distinct icon/label in the timeline.
- **Result**: ☐ Pass ☐ Fail

### TC-7.3: Follow-up date indicator on list
- **Steps**:
  1. Check enquiry list for the row with a follow-up due today/tomorrow
- **Expected**: Color-coded badge: Green (upcoming), Amber (due soon), Red (overdue).
- **Result**: ☐ Pass ☐ Fail

### TC-7.4: Follow-Up Board
- **Steps**:
  1. Navigate to Follow-Up Board page
- **Expected**: Board/calendar view showing follow-ups organized by date.
- **Result**: ☐ Pass ☐ Fail

---

## 💰 TEST SUITE 8: Quotation Management

### TC-8.1: Create quotation from enquiry
- **Steps**:
  1. Open an enquiry with status "Technical Review" or later
  2. Look for "Create Quotation" or navigate to Quotations page
  3. Create quotation linked to the enquiry
- **Expected**: Quotation created with `QT-YYYY-MM-NNNN` ID. Linked to enquiry and customer.
- **Result**: ☐ Pass ☐ Fail

### TC-8.2: Add line items
- **Steps**:
  1. Open quotation detail
  2. Add line item: Description, Material Grade, Quantity, Unit Price, GST Rate
  3. Add a second line item
- **Expected**: Line totals calculated automatically. Grand total = sum of all line totals + freight + GST.
- **Result**: ☐ Pass ☐ Fail

### TC-8.3: Commercial totals calculation
- **Steps**:
  1. Add items with different prices and GST rates
  2. Check: Subtotal (excl GST), Total GST, Grand Total
- **Expected**: All calculations correct. Match manual calculation.
- **Result**: ☐ Pass ☐ Fail

### TC-8.4: Quotation status workflow
- **Steps**:
  1. Change status through: Draft → Pending Technical Review → Pending Commercial Review → Sent → Accepted
- **Expected**: Each status change saves. Visual badge updates.
- **Result**: ☐ Pass ☐ Fail

### TC-8.5: Revision tracking
- **Steps**:
  1. Revise a quotation (change a line item)
  2. Save with revision reason
- **Expected**: Revision number increments. Revision reason stored.
- **Result**: ☐ Pass ☐ Fail

---

## 📊 TEST SUITE 9: QAP Management

### TC-9.1: Create QAP from quotation
- **Steps**:
  1. Navigate to QAPs page
  2. Create QAP linked to an approved quotation
- **Expected**: QAP created with `QAP-YYYY-MM-NNNN` ID.
- **Result**: ☐ Pass ☐ Fail

### TC-9.2: Add inspection activities
- **Steps**:
  1. Open QAP detail
  2. Add inspection activity: Stage = "Raw Material Receipt", Activity = "Material Test Certificate Review", Reference = "ASME Sec II", Acceptance = "Per specification"
- **Expected**: Activity added to matrix. Inspection type selectable (H/W/R/I).
- **Result**: ☐ Pass ☐ Fail

### TC-9.3: Document checklist
- **Steps**:
  1. Add document: Type = "MTC", Status = "Awaited"
  2. Update status to "Received"
- **Expected**: Document status updates. Reviewed By auto-populated.
- **Result**: ☐ Pass ☐ Fail

### TC-9.4: QAP status workflow
- **Steps**:
  1. Change status: Draft → QC Review → Pending Director Approval → Sent to Client
- **Expected**: Each status change persists.
- **Result**: ☐ Pass ☐ Fail

---

## 🤖 TEST SUITE 10: Automation & Notifications

### TC-10.1: New enquiry notification
- **Steps**:
  1. Create a new enquiry assigned to a different user
  2. Login as that user
  3. Check notification bell
- **Expected**: Notification: "New Enquiry Assigned — ENQ-XXXX has been assigned to you."
- **Result**: ☐ Pass ☐ Fail

### TC-10.2: Urgent priority notification
- **Steps**:
  1. Create an enquiry with Priority = "Urgent"
  2. Login as Director
  3. Check notification bell
- **Expected**: Notification: "🚨 Urgent Lead Alert — Immediate action required."
- **Result**: ☐ Pass ☐ Fail

### TC-10.3: Lost status notification
- **Steps**:
  1. Change an enquiry status to "Lost"
  2. Login as Director
  3. Check notification bell
- **Expected**: Notification: "Enquiry Marked Lost — Reason: [reason]."
- **Result**: ☐ Pass ☐ Fail

### TC-10.4: Auto-generated task on enquiry creation
- **Steps**:
  1. Create a new enquiry
  2. Navigate to Tasks page
- **Expected**: System-generated task exists: "Follow up on New Enquiry ENQ-XXXX" with due date = tomorrow.
- **Result**: ☐ Pass ☐ Fail

### TC-10.5: Audit log tracking
- **Steps**:
  1. Perform any CRUD action (create enquiry, edit customer, etc.)
  2. Navigate to Audit Log page
- **Expected**: Entry logged with: Action, Module, User, Timestamp, Before/After data.
- **Result**: ☐ Pass ☐ Fail

---

## 🔒 TEST SUITE 11: RBAC (Role-Based Access)

> Create test users with different roles and verify access restrictions.

### TC-11.1: Sales role cannot access Admin pages
- **Steps**:
  1. Login as Sales Executive
  2. Try to navigate to `/app/admin/users`
- **Expected**: Page hidden from sidebar or access denied.
- **Result**: ☐ Pass ☐ Fail

### TC-11.2: QC role cannot edit pricing fields
- **Steps**:
  1. Login as QC Engineer
  2. Open a quotation
  3. Try to edit Unit Price or Margin fields
- **Expected**: Price fields hidden or read-only for QC roles.
- **Result**: ☐ Pass ☐ Fail

### TC-11.3: Sales cannot approve own quotation
- **Steps**:
  1. Login as Sales
  2. Create a quotation
  3. Try to change status to "Approved"
- **Expected**: Approve action restricted. Only Director/SA can approve.
- **Result**: ☐ Pass ☐ Fail

---

## 📱 TEST SUITE 12: Cross-Browser & Responsive

### TC-12.1: Chrome desktop
- **Steps**: Run full test suite on Chrome (latest)
- **Result**: ☐ Pass ☐ Fail

### TC-12.2: Firefox desktop
- **Steps**: Test login + enquiry creation on Firefox
- **Result**: ☐ Pass ☐ Fail

### TC-12.3: Mobile viewport (375px)
- **Steps**: 
  1. Open Chrome DevTools
  2. Toggle device toolbar, select iPhone 14
  3. Navigate through: Login → Dashboard → Enquiries → Enquiry Detail
- **Expected**: All pages readable. No horizontal scroll. Modals scroll properly.
- **Result**: ☐ Pass ☐ Fail

---

## 🐛 Bug Report Template

When reporting bugs, use this format:

```
**Bug ID**: BUG-XXX
**Test Case**: TC-X.X
**Severity**: Critical / Major / Minor / Cosmetic
**Browser**: Chrome 120 / Firefox 115 / Edge
**Screen**: Page name / URL

**Steps to Reproduce**:
1. ...
2. ...

**Expected**: What should happen
**Actual**: What actually happened

**Screenshot**: [attach screenshot]
**Console Errors**: [paste any JS console errors]
```

---

## ✅ Test Summary

| Suite | Total Tests | Pass | Fail | Blocked |
|---|---|---|---|---|
| 1. Authentication | 6 | | | |
| 2. User Management | 6 | | | |
| 3. Customer Master | 8 | | | |
| 4. System Settings | 4 | | | |
| 5. Enquiry Management | 15 | | | |
| 6. Dynamic Fields | 4 | | | |
| 7. Follow-Up Engine | 4 | | | |
| 8. Quotation | 5 | | | |
| 9. QAP | 4 | | | |
| 10. Automation | 5 | | | |
| 11. RBAC | 3 | | | |
| 12. Cross-Browser | 3 | | | |
| **TOTAL** | **67** | | | |

> **Sign-off**: QA Tester Name: _____________ Date: _____________
