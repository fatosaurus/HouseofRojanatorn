SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.gallery_assets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.gallery_assets (
        id UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT PK_gallery_assets PRIMARY KEY
            CONSTRAINT DF_gallery_assets_id DEFAULT NEWID(),
        photo_url NVARCHAR(MAX) NOT NULL,
        attached_customer_id UNIQUEIDENTIFIER NULL,
        attached_project_id INT NULL,
        attached_inventory_item_id INT NULL,
        created_by NVARCHAR(255) NULL,
        created_at_utc DATETIME2 NOT NULL
            CONSTRAINT DF_gallery_assets_created_at DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL
            CONSTRAINT DF_gallery_assets_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_gallery_assets_customer FOREIGN KEY (attached_customer_id) REFERENCES dbo.customers(id),
        CONSTRAINT FK_gallery_assets_project FOREIGN KEY (attached_project_id) REFERENCES dbo.manufacturing_projects(id),
        CONSTRAINT FK_gallery_assets_inventory FOREIGN KEY (attached_inventory_item_id) REFERENCES dbo.inventory_items(id)
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_gallery_assets_created_at'
      AND object_id = OBJECT_ID('dbo.gallery_assets')
)
BEGIN
    CREATE INDEX IX_gallery_assets_created_at
        ON dbo.gallery_assets(created_at_utc DESC);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_gallery_assets_attachment'
      AND object_id = OBJECT_ID('dbo.gallery_assets')
)
BEGIN
    CREATE INDEX IX_gallery_assets_attachment
        ON dbo.gallery_assets(attached_customer_id, attached_project_id, attached_inventory_item_id);
END;

COMMIT TRANSACTION;
