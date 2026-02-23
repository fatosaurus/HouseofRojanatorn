-- Manufacturing pricing/customer enhancement columns and option sets.

IF COL_LENGTH('dbo.manufacturing_projects', 'maximum_discounted_price') IS NULL
BEGIN
    ALTER TABLE dbo.manufacturing_projects
    ADD maximum_discounted_price DECIMAL(18,2) NOT NULL CONSTRAINT DF_manufacturing_projects_maximum_discounted_price DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.manufacturing_projects', 'custom_order') IS NULL
BEGIN
    ALTER TABLE dbo.manufacturing_projects
    ADD custom_order BIT NOT NULL CONSTRAINT DF_manufacturing_projects_custom_order DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.manufacturing_projects', 'material') IS NULL
BEGIN
    ALTER TABLE dbo.manufacturing_projects
    ADD material NVARCHAR(80) NULL;
END
GO

UPDATE dbo.manufacturing_projects
SET custom_order = 1
WHERE customer_id IS NOT NULL;
GO

IF OBJECT_ID('dbo.manufacturing_option_sets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_option_sets (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        option_key NVARCHAR(80) NOT NULL,
        label NVARCHAR(140) NOT NULL,
        options_json NVARCHAR(MAX) NOT NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_option_sets')
      AND name = 'UX_manufacturing_option_sets_option_key'
)
BEGIN
    CREATE UNIQUE INDEX UX_manufacturing_option_sets_option_key
        ON dbo.manufacturing_option_sets(option_key);
END
GO

MERGE dbo.manufacturing_option_sets AS target
USING (
    SELECT 'material' AS option_key, 'Material' AS label, '["Silver","10K Gold","18K Gold"]' AS options_json
    UNION ALL
    SELECT 'metal_plating', 'Metal Plating', '["White Gold","Gold","Rose Gold"]'
) AS source
ON target.option_key = source.option_key
WHEN MATCHED THEN
    UPDATE SET
        label = source.label,
        options_json = source.options_json,
        updated_at_utc = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (option_key, label, options_json, updated_at_utc)
    VALUES (source.option_key, source.label, source.options_json, SYSUTCDATETIME());
GO
