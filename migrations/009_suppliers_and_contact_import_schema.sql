-- Supplier domain + workbook contact import support columns.

IF COL_LENGTH('dbo.customers', 'source_system') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD source_system NVARCHAR(64) NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'source_contact_id') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD source_contact_id INT NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'organization_name') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD organization_name NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'tax_id') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD tax_id NVARCHAR(64) NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'contact_type') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD contact_type NVARCHAR(64) NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'source_channel') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD source_channel NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'shipping_address') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD shipping_address NVARCHAR(400) NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'shipping_email') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD shipping_email NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.customers', 'shipping_phone') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD shipping_phone NVARCHAR(64) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.customers')
      AND name = 'UX_customers_source_contact'
)
BEGIN
    CREATE UNIQUE INDEX UX_customers_source_contact
        ON dbo.customers(source_system, source_contact_id)
        WHERE source_system IS NOT NULL
          AND source_contact_id IS NOT NULL;
END
GO

IF OBJECT_ID('dbo.suppliers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.suppliers (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        source_system NVARCHAR(64) NULL,
        source_contact_id INT NULL,
        name NVARCHAR(180) NOT NULL,
        contact_name NVARCHAR(180) NULL,
        organization_name NVARCHAR(255) NULL,
        branch_name NVARCHAR(120) NULL,
        email NVARCHAR(255) NULL,
        phone NVARCHAR(64) NULL,
        address NVARCHAR(400) NULL,
        tax_id NVARCHAR(64) NULL,
        source_channel NVARCHAR(255) NULL,
        shipping_address NVARCHAR(400) NULL,
        shipping_email NVARCHAR(255) NULL,
        shipping_phone NVARCHAR(64) NULL,
        notes NVARCHAR(MAX) NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.suppliers')
      AND name = 'UX_suppliers_source_contact'
)
BEGIN
    CREATE UNIQUE INDEX UX_suppliers_source_contact
        ON dbo.suppliers(source_system, source_contact_id)
        WHERE source_system IS NOT NULL
          AND source_contact_id IS NOT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.suppliers')
      AND name = 'IX_suppliers_name'
)
BEGIN
    CREATE INDEX IX_suppliers_name
        ON dbo.suppliers(name);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.suppliers')
      AND name = 'IX_suppliers_email'
)
BEGIN
    CREATE INDEX IX_suppliers_email
        ON dbo.suppliers(email);
END
GO

IF OBJECT_ID('dbo.supplier_purchase_history', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier_purchase_history (
        id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        supplier_id UNIQUEIDENTIFIER NOT NULL,
        purchase_date DATE NULL,
        reference_no NVARCHAR(80) NULL,
        description NVARCHAR(400) NULL,
        currency_code NVARCHAR(8) NOT NULL CONSTRAINT DF_supplier_purchase_history_currency DEFAULT N'THB',
        subtotal_amount DECIMAL(18,2) NULL,
        tax_amount DECIMAL(18,2) NULL,
        total_amount DECIMAL(18,2) NULL,
        status NVARCHAR(40) NOT NULL CONSTRAINT DF_supplier_purchase_history_status DEFAULT N'recorded',
        notes NVARCHAR(MAX) NULL,
        attachment_urls_json NVARCHAR(MAX) NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_supplier_purchase_history_supplier
            FOREIGN KEY (supplier_id)
            REFERENCES dbo.suppliers(id)
            ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.supplier_purchase_history')
      AND name = 'IX_supplier_purchase_history_supplier_date'
)
BEGIN
    CREATE INDEX IX_supplier_purchase_history_supplier_date
        ON dbo.supplier_purchase_history(supplier_id, purchase_date DESC, id DESC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.supplier_purchase_history')
      AND name = 'IX_supplier_purchase_history_reference'
)
BEGIN
    CREATE INDEX IX_supplier_purchase_history_reference
        ON dbo.supplier_purchase_history(reference_no);
END
GO
