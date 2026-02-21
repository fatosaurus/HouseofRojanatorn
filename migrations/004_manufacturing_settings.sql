-- Dynamic manufacturing settings for pipeline steps and custom project fields.

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_manufacturing_projects_status'
      AND parent_object_id = OBJECT_ID('dbo.manufacturing_projects')
)
BEGIN
    ALTER TABLE dbo.manufacturing_projects
    DROP CONSTRAINT CK_manufacturing_projects_status;
END
GO

IF COL_LENGTH('dbo.manufacturing_projects', 'custom_fields_json') IS NULL
BEGIN
    ALTER TABLE dbo.manufacturing_projects
    ADD custom_fields_json NVARCHAR(MAX) NULL;
END
GO

IF OBJECT_ID('dbo.manufacturing_process_steps', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_process_steps (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        step_key NVARCHAR(80) NOT NULL,
        label NVARCHAR(140) NOT NULL,
        sort_order INT NOT NULL,
        require_photo BIT NOT NULL DEFAULT 0,
        require_comment BIT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_process_steps')
      AND name = 'UX_manufacturing_process_steps_step_key'
)
BEGIN
    CREATE UNIQUE INDEX UX_manufacturing_process_steps_step_key
        ON dbo.manufacturing_process_steps(step_key);
END
GO

IF OBJECT_ID('dbo.manufacturing_custom_fields', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_custom_fields (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        field_key NVARCHAR(80) NOT NULL,
        label NVARCHAR(140) NOT NULL,
        field_type NVARCHAR(40) NOT NULL DEFAULT 'text',
        sort_order INT NOT NULL,
        is_required BIT NOT NULL DEFAULT 0,
        is_active BIT NOT NULL DEFAULT 1,
        is_system BIT NOT NULL DEFAULT 0,
        options_json NVARCHAR(MAX) NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_custom_fields')
      AND name = 'UX_manufacturing_custom_fields_field_key'
)
BEGIN
    CREATE UNIQUE INDEX UX_manufacturing_custom_fields_field_key
        ON dbo.manufacturing_custom_fields(field_key);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.manufacturing_process_steps)
BEGIN
    INSERT INTO dbo.manufacturing_process_steps (step_key, label, sort_order, require_photo, require_comment, is_active)
    VALUES
        ('approved', 'Approved', 1, 0, 0, 1),
        ('sent_to_craftsman', 'Sent To Craftsman', 2, 0, 1, 1),
        ('internal_setting_qc', 'Internal Setting QC', 3, 1, 1, 1),
        ('diamond_sorting', 'Diamond Sorting', 4, 1, 0, 1),
        ('stone_setting', 'Stone Setting', 5, 1, 0, 1),
        ('plating', 'Plating', 6, 1, 1, 1),
        ('final_piece_qc', 'Final Piece QC', 7, 1, 1, 1),
        ('complete_piece', 'Complete Piece', 8, 1, 1, 1),
        ('ready_for_sale', 'Ready For Sale', 9, 1, 1, 1),
        ('sold', 'Sold', 10, 0, 1, 1);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.manufacturing_custom_fields)
BEGIN
    INSERT INTO dbo.manufacturing_custom_fields (field_key, label, field_type, sort_order, is_required, is_active, is_system, options_json)
    VALUES
        ('designerName', 'Designer', 'text', 1, 0, 1, 1, '[]'),
        ('craftsmanName', 'Craftsman', 'text', 2, 0, 1, 1, '[]');
END
GO
