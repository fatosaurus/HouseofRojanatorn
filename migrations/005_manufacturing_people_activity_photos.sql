-- Manufacturing workforce registry + activity photo evidence support.

IF OBJECT_ID('dbo.manufacturing_people', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_people (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        role NVARCHAR(32) NOT NULL,
        name NVARCHAR(180) NOT NULL,
        email NVARCHAR(255) NULL,
        phone NVARCHAR(64) NULL,
        is_active BIT NOT NULL DEFAULT 1,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_manufacturing_people_role CHECK (role IN ('designer', 'craftsman'))
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_people')
      AND name = 'UX_manufacturing_people_role_name'
)
BEGIN
    CREATE UNIQUE INDEX UX_manufacturing_people_role_name
        ON dbo.manufacturing_people(role, name);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_people')
      AND name = 'IX_manufacturing_people_role_active'
)
BEGIN
    CREATE INDEX IX_manufacturing_people_role_active
        ON dbo.manufacturing_people(role, is_active, name);
END
GO

IF COL_LENGTH('dbo.manufacturing_activity_log', 'photos_json') IS NULL
BEGIN
    ALTER TABLE dbo.manufacturing_activity_log
    ADD photos_json NVARCHAR(MAX) NULL;
END
GO

;WITH DistinctDesigners AS (
    SELECT DISTINCT
        LTRIM(RTRIM(mp.designer_name)) AS person_name
    FROM dbo.manufacturing_projects mp
    WHERE mp.designer_name IS NOT NULL
      AND LTRIM(RTRIM(mp.designer_name)) <> ''
)
INSERT INTO dbo.manufacturing_people (role, name, is_active, updated_at_utc)
SELECT
    'designer' AS role,
    d.person_name,
    1 AS is_active,
    SYSUTCDATETIME() AS updated_at_utc
FROM DistinctDesigners d
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.manufacturing_people p
    WHERE p.role = 'designer'
      AND p.name = d.person_name
);

;WITH DistinctCraftsmen AS (
    SELECT DISTINCT
        LTRIM(RTRIM(mp.craftsman_name)) AS person_name
    FROM dbo.manufacturing_projects mp
    WHERE mp.craftsman_name IS NOT NULL
      AND LTRIM(RTRIM(mp.craftsman_name)) <> ''
)
INSERT INTO dbo.manufacturing_people (role, name, is_active, updated_at_utc)
SELECT
    'craftsman' AS role,
    c.person_name,
    1 AS is_active,
    SYSUTCDATETIME() AS updated_at_utc
FROM DistinctCraftsmen c
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.manufacturing_people p
    WHERE p.role = 'craftsman'
      AND p.name = c.person_name
);
GO
