-- Gem inventory + usage schema derived from the ROJANATORN GEMS STOCK 2026 workbook.

IF OBJECT_ID('dbo.gem_inventory_items', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.gem_inventory_items (
        id INT IDENTITY(1,1) PRIMARY KEY,
        source_sheet NVARCHAR(64) NOT NULL,
        source_row INT NULL,
        gemstone_number INT NULL,
        gemstone_number_text NVARCHAR(64) NULL,
        gemstone_type NVARCHAR(200) NULL,
        weight_pcs_raw NVARCHAR(160) NULL,
        shape NVARCHAR(80) NULL,
        price_per_ct_raw NVARCHAR(80) NULL,
        price_per_piece_raw NVARCHAR(80) NULL,
        buying_date DATE NULL,
        buying_date_raw NVARCHAR(80) NULL,
        balance_pcs DECIMAL(18,4) NULL,
        balance_ct DECIMAL(18,4) NULL,
        use_date DATE NULL,
        use_date_raw NVARCHAR(80) NULL,
        owner_name NVARCHAR(120) NULL,
        parsed_weight_ct DECIMAL(18,4) NULL,
        parsed_quantity_pcs DECIMAL(18,4) NULL,
        parsed_price_per_ct DECIMAL(18,4) NULL,
        parsed_price_per_piece DECIMAL(18,4) NULL,
        imported_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.gem_inventory_items')
      AND name = 'UX_gem_inventory_items_gemstone_number'
)
BEGIN
    DROP INDEX UX_gem_inventory_items_gemstone_number ON dbo.gem_inventory_items;
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.gem_inventory_items')
      AND name = 'IX_gem_inventory_items_gemstone_number'
)
BEGIN
    CREATE INDEX IX_gem_inventory_items_gemstone_number
        ON dbo.gem_inventory_items(gemstone_number);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.gem_inventory_items')
      AND name = 'IX_gem_inventory_items_type'
)
BEGIN
    CREATE INDEX IX_gem_inventory_items_type ON dbo.gem_inventory_items(gemstone_type);
END
GO

IF OBJECT_ID('dbo.gem_usage_batches', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.gem_usage_batches (
        id INT IDENTITY(1,1) PRIMARY KEY,
        source_sheet NVARCHAR(64) NOT NULL,
        source_row INT NULL,
        product_category NVARCHAR(64) NOT NULL,
        transaction_date DATE NULL,
        transaction_date_raw NVARCHAR(80) NULL,
        requester_name NVARCHAR(160) NULL,
        product_code NVARCHAR(64) NULL,
        total_amount DECIMAL(18,4) NULL,
        imported_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.gem_usage_batches')
      AND name = 'IX_gem_usage_batches_product_code'
)
BEGIN
    CREATE INDEX IX_gem_usage_batches_product_code ON dbo.gem_usage_batches(product_code);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.gem_usage_batches')
      AND name = 'IX_gem_usage_batches_transaction_date'
)
BEGIN
    CREATE INDEX IX_gem_usage_batches_transaction_date ON dbo.gem_usage_batches(transaction_date DESC);
END
GO

IF OBJECT_ID('dbo.gem_usage_lines', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.gem_usage_lines (
        id INT IDENTITY(1,1) PRIMARY KEY,
        batch_id INT NOT NULL,
        source_row INT NULL,
        gemstone_number INT NULL,
        gemstone_name NVARCHAR(200) NULL,
        used_pcs DECIMAL(18,4) NULL,
        used_weight_ct DECIMAL(18,4) NULL,
        unit_price_raw NVARCHAR(80) NULL,
        line_amount DECIMAL(18,4) NULL,
        balance_pcs_after DECIMAL(18,4) NULL,
        balance_ct_after DECIMAL(18,4) NULL,
        requester_name NVARCHAR(160) NULL,
        imported_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_gem_usage_lines_batch_id
            FOREIGN KEY (batch_id) REFERENCES dbo.gem_usage_batches(id)
            ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.gem_usage_lines')
      AND name = 'IX_gem_usage_lines_batch_id'
)
BEGIN
    CREATE INDEX IX_gem_usage_lines_batch_id ON dbo.gem_usage_lines(batch_id);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.gem_usage_lines')
      AND name = 'IX_gem_usage_lines_gemstone_number'
)
BEGIN
    CREATE INDEX IX_gem_usage_lines_gemstone_number ON dbo.gem_usage_lines(gemstone_number);
END
GO
