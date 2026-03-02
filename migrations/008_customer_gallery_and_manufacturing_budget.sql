-- Add customer photo gallery and manufacturing budget fields.

IF COL_LENGTH('dbo.customers', 'photos_json') IS NULL
BEGIN
    ALTER TABLE dbo.customers
    ADD photos_json NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.manufacturing_projects', 'budget') IS NULL
BEGIN
    ALTER TABLE dbo.manufacturing_projects
    ADD budget DECIMAL(18,2) NULL;
END
GO
