-- Customer + manufacturing domain schema aligned to the v0 reference prototype.

IF OBJECT_ID('dbo.customers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.customers (
        id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(180) NOT NULL,
        nickname NVARCHAR(120) NULL,
        email NVARCHAR(255) NULL,
        phone NVARCHAR(64) NULL,
        address NVARCHAR(400) NULL,
        notes NVARCHAR(MAX) NULL,
        photo_url NVARCHAR(1024) NULL,
        customer_since DATETIME2 NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.customers')
      AND name = 'IX_customers_name'
)
BEGIN
    CREATE INDEX IX_customers_name ON dbo.customers(name);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.customers')
      AND name = 'IX_customers_email'
)
BEGIN
    CREATE INDEX IX_customers_email ON dbo.customers(email);
END
GO

IF OBJECT_ID('dbo.manufacturing_projects', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_projects (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        manufacturing_code NVARCHAR(64) NOT NULL,
        piece_name NVARCHAR(180) NOT NULL,
        piece_type NVARCHAR(40) NULL,
        design_date DATE NULL,
        designer_name NVARCHAR(120) NULL,
        status NVARCHAR(40) NOT NULL,
        craftsman_name NVARCHAR(120) NULL,
        metal_plating_json NVARCHAR(MAX) NULL,
        metal_plating_notes NVARCHAR(MAX) NULL,
        setting_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
        diamond_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
        gemstone_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
        total_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
        selling_price DECIMAL(18,2) NOT NULL DEFAULT 0,
        completion_date DATE NULL,
        usage_notes NVARCHAR(MAX) NULL,
        photos_json NVARCHAR(MAX) NULL,
        customer_id UNIQUEIDENTIFIER NULL,
        sold_at DATETIME2 NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_manufacturing_projects_status CHECK (
            status IN (
                'approved',
                'sent_to_craftsman',
                'internal_setting_qc',
                'diamond_sorting',
                'stone_setting',
                'plating',
                'final_piece_qc',
                'complete_piece',
                'ready_for_sale',
                'sold'
            )
        ),
        CONSTRAINT FK_manufacturing_projects_customer_id
            FOREIGN KEY (customer_id)
            REFERENCES dbo.customers(id)
            ON DELETE SET NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_projects')
      AND name = 'UX_manufacturing_projects_code'
)
BEGIN
    CREATE UNIQUE INDEX UX_manufacturing_projects_code
        ON dbo.manufacturing_projects(manufacturing_code);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_projects')
      AND name = 'IX_manufacturing_projects_status'
)
BEGIN
    CREATE INDEX IX_manufacturing_projects_status
        ON dbo.manufacturing_projects(status, updated_at_utc DESC);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_projects')
      AND name = 'IX_manufacturing_projects_customer_id'
)
BEGIN
    CREATE INDEX IX_manufacturing_projects_customer_id
        ON dbo.manufacturing_projects(customer_id);
END
GO

IF OBJECT_ID('dbo.manufacturing_project_gemstones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_project_gemstones (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        project_id INT NOT NULL,
        inventory_item_id INT NULL,
        gemstone_code NVARCHAR(64) NULL,
        gemstone_type NVARCHAR(200) NULL,
        pieces_used DECIMAL(18,4) NOT NULL DEFAULT 0,
        weight_used_ct DECIMAL(18,4) NOT NULL DEFAULT 0,
        line_cost DECIMAL(18,2) NOT NULL DEFAULT 0,
        notes NVARCHAR(MAX) NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_manufacturing_project_gemstones_project_id
            FOREIGN KEY (project_id)
            REFERENCES dbo.manufacturing_projects(id)
            ON DELETE CASCADE,
        CONSTRAINT FK_manufacturing_project_gemstones_inventory_item_id
            FOREIGN KEY (inventory_item_id)
            REFERENCES dbo.gem_inventory_items(id)
            ON DELETE SET NULL
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_project_gemstones')
      AND name = 'IX_manufacturing_project_gemstones_project_id'
)
BEGIN
    CREATE INDEX IX_manufacturing_project_gemstones_project_id
        ON dbo.manufacturing_project_gemstones(project_id);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_project_gemstones')
      AND name = 'IX_manufacturing_project_gemstones_inventory_item_id'
)
BEGIN
    CREATE INDEX IX_manufacturing_project_gemstones_inventory_item_id
        ON dbo.manufacturing_project_gemstones(inventory_item_id);
END
GO

IF OBJECT_ID('dbo.manufacturing_activity_log', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_activity_log (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        project_id INT NOT NULL,
        status NVARCHAR(40) NOT NULL,
        activity_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        craftsman_name NVARCHAR(120) NULL,
        notes NVARCHAR(MAX) NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_manufacturing_activity_log_project_id
            FOREIGN KEY (project_id)
            REFERENCES dbo.manufacturing_projects(id)
            ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_activity_log')
      AND name = 'IX_manufacturing_activity_log_project_id'
)
BEGIN
    CREATE INDEX IX_manufacturing_activity_log_project_id
        ON dbo.manufacturing_activity_log(project_id, activity_at_utc DESC);
END
GO
