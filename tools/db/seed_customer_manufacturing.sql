-- Seed baseline customer records.
-- Manufacturing records are now rebuilt from imported usage batches/lines via:
-- tools/db/rebuild_manufacturing_from_usage.sql

IF NOT EXISTS (SELECT 1 FROM dbo.customers WHERE email = 'vip.nicha@houseofrojanatorn.local')
BEGIN
    INSERT INTO dbo.customers (name, nickname, email, phone, address, notes, customer_since)
    VALUES (
        N'Nicha Rojanatorn',
        N'Nicha',
        N'vip.nicha@houseofrojanatorn.local',
        N'+66-81-234-5001',
        N'Bangkok, Thailand',
        N'VIP collector focused on brooch and necklace commissions.',
        DATEADD(DAY, -420, SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.customers WHERE email = 'poranee.chan@houseofrojanatorn.local')
BEGIN
    INSERT INTO dbo.customers (name, nickname, email, phone, address, notes, customer_since)
    VALUES (
        N'Poranee Chantra',
        N'Ploy',
        N'poranee.chan@houseofrojanatorn.local',
        N'+66-86-520-1188',
        N'Chiang Mai, Thailand',
        N'Orders bridal and family legacy pieces.',
        DATEADD(DAY, -260, SYSUTCDATETIME())
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.customers WHERE email = 'michael.tan@houseofrojanatorn.local')
BEGIN
    INSERT INTO dbo.customers (name, nickname, email, phone, address, notes, customer_since)
    VALUES (
        N'Michael Tan',
        N'Mike',
        N'michael.tan@houseofrojanatorn.local',
        N'+65-9123-7788',
        N'Singapore',
        N'Prefers modern art-deco style earrings and cufflinks.',
        DATEADD(DAY, -190, SYSUTCDATETIME())
    );
END
GO
