# Business Logic Requirements - HSM-Tera Management System

## Customer Code Generation & Validation

### Current Issues:
1. Customer code is not auto-generated
2. Admin can input any number without validation
3. No check if customer code already exists
4. Format should be: `GD7-{NUMBER}` (e.g., GD7-1, GD7-2, GD7-3...)

### Required Logic:
1. **Auto-generate customer codes** with format `GD7-{NUMBER}`
2. **Find the next available number** by checking existing customer codes
3. **Validate uniqueness** - ensure no duplicate customer codes
4. **Admin can still input custom number** but system validates it's unique
5. **Display format**: Show `GD7-` prefix with input field for number only

### Implementation:
- Get all existing customer codes from database
- Extract numbers from existing codes (GD7-1, GD7-2, etc.)
- Find the next available number
- Auto-fill the input field with next number
- Validate on form submission that code is unique

## Start Date Logic

### Current Issues:
1. Start date should load from environment variable
2. Date should not be editable by admin
3. Should be read-only field

### Required Logic:
1. **Load start date from `.env` file** (`DEFAULT_START_DATE`)
2. **Make field read-only** - admin cannot edit
3. **Display current start date** from environment
4. **Use this date for all new customers**

### Implementation:
- Read `DEFAULT_START_DATE` from environment
- Set input field as `readonly`
- Display the date in a non-editable format
- Use this date when creating new customers

## Month/Date Generation Logic

### Current Issues:
1. Calendar shows 30 months from start date
2. Dates should be non-editable
3. Should use environment start date as base

### Required Logic:
1. **Generate 30 months** starting from `DEFAULT_START_DATE`
2. **Make dates read-only** in dropdowns
3. **Format dates properly** (e.g., "Dec-2024 (1)", "Jan-2025 (2)")
4. **Use sequential numbering** (1, 2, 3... 30)

### Implementation:
- Start from `DEFAULT_START_DATE` from environment
- Generate 30 sequential months
- Format as "Month-YYYY (N)" where N is sequential number
- Make all date selectors read-only

## File Locations to Update:

1. **`scripts/main.js`** - Add IPC handlers for:
   - Get next customer code
   - Validate customer code uniqueness
   - Get default start date from environment

2. **`pages/add-customer.html`** - Update form:
   - Auto-generate customer code
   - Make start date read-only
   - Add validation for customer code

3. **`pages/add-payment.html`** - Update month selector:
   - Use environment start date
   - Make dates read-only
   - Generate 30 months properly

4. **`pages/dashboard.html`** - Update month selector:
   - Use environment start date
   - Make dates read-only
   - Generate 30 months properly

## Environment Variables Required:
- `DEFAULT_START_DATE=2024-12-15` (or your preferred start date)
- `CUSTOMER_CODE_PREFIX=GD7-` (already exists)

## Priority Order:
1. Fix customer code generation and validation
2. Fix start date to be read-only from environment
3. Fix month generation logic across all pages
4. Test all functionality
