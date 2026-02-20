-- Baseline schema for House of Rojanatorn

IF OBJECT_ID('dbo.app_settings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_settings (
        id INT IDENTITY(1,1) PRIMARY KEY,
        setting_key NVARCHAR(120) NOT NULL UNIQUE,
        setting_value NVARCHAR(4000) NULL,
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.app_settings WHERE setting_key = 'app_initialized')
BEGIN
    INSERT INTO dbo.app_settings (setting_key, setting_value)
    VALUES ('app_initialized', 'true');
END
GO
