-- Seed baseline customer + manufacturing demo records for local/testing environments.
-- Safe to run multiple times; uses deterministic keys and existence checks.

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

DECLARE @customerNicha UNIQUEIDENTIFIER = (
    SELECT TOP 1 id FROM dbo.customers WHERE email = 'vip.nicha@houseofrojanatorn.local'
);
DECLARE @customerPoranee UNIQUEIDENTIFIER = (
    SELECT TOP 1 id FROM dbo.customers WHERE email = 'poranee.chan@houseofrojanatorn.local'
);
DECLARE @customerMichael UNIQUEIDENTIFIER = (
    SELECT TOP 1 id FROM dbo.customers WHERE email = 'michael.tan@houseofrojanatorn.local'
);

IF NOT EXISTS (SELECT 1 FROM dbo.manufacturing_projects WHERE manufacturing_code = 'ND2602001')
BEGIN
    INSERT INTO dbo.manufacturing_projects (
        manufacturing_code,
        piece_name,
        piece_type,
        design_date,
        designer_name,
        status,
        craftsman_name,
        metal_plating_json,
        metal_plating_notes,
        setting_cost,
        diamond_cost,
        gemstone_cost,
        total_cost,
        selling_price,
        completion_date,
        usage_notes,
        photos_json,
        customer_id,
        sold_at
    )
    VALUES (
        N'ND2602001',
        N'Lotus Crown Necklace',
        N'necklace',
        CAST(DATEADD(DAY, -48, SYSUTCDATETIME()) AS DATE),
        N'ML Rojanatorn',
        N'sold',
        N'Pichai',
        N'["white_gold","rose_gold"]',
        N'Dual-toned plating with hand-polished finish.',
        55000,
        86000,
        72000,
        213000,
        268000,
        CAST(DATEADD(DAY, -14, SYSUTCDATETIME()) AS DATE),
        N'Sold after VIP preview.',
        N'[]',
        @customerNicha,
        DATEADD(DAY, -10, SYSUTCDATETIME())
    );
END

IF NOT EXISTS (SELECT 1 FROM dbo.manufacturing_projects WHERE manufacturing_code = 'ND2602002')
BEGIN
    INSERT INTO dbo.manufacturing_projects (
        manufacturing_code,
        piece_name,
        piece_type,
        design_date,
        designer_name,
        status,
        craftsman_name,
        metal_plating_json,
        metal_plating_notes,
        setting_cost,
        diamond_cost,
        gemstone_cost,
        total_cost,
        selling_price,
        completion_date,
        usage_notes,
        photos_json,
        customer_id,
        sold_at
    )
    VALUES (
        N'ND2602002',
        N'Heritage Emerald Brooch',
        N'brooch',
        CAST(DATEADD(DAY, -32, SYSUTCDATETIME()) AS DATE),
        N'Praewa',
        N'ready_for_sale',
        N'Tui',
        N'["gold"]',
        N'Classic yellow-gold tone.',
        42000,
        51000,
        46000,
        139000,
        184000,
        CAST(DATEADD(DAY, -4, SYSUTCDATETIME()) AS DATE),
        N'Ready for in-stock display and certificate generation.',
        N'[]',
        NULL,
        NULL
    );
END

IF NOT EXISTS (SELECT 1 FROM dbo.manufacturing_projects WHERE manufacturing_code = 'ND2602003')
BEGIN
    INSERT INTO dbo.manufacturing_projects (
        manufacturing_code,
        piece_name,
        piece_type,
        design_date,
        designer_name,
        status,
        craftsman_name,
        metal_plating_json,
        metal_plating_notes,
        setting_cost,
        diamond_cost,
        gemstone_cost,
        total_cost,
        selling_price,
        completion_date,
        usage_notes,
        photos_json,
        customer_id,
        sold_at
    )
    VALUES (
        N'ND2602003',
        N'Celestial Drop Earrings',
        N'earrings',
        CAST(DATEADD(DAY, -12, SYSUTCDATETIME()) AS DATE),
        N'Dao',
        N'stone_setting',
        N'Ti',
        N'["white_gold"]',
        N'Rhodium plating for high contrast.',
        21000,
        32000,
        26000,
        79000,
        116000,
        NULL,
        N'Pending final setting QC.',
        N'[]',
        @customerMichael,
        NULL
    );
END
GO

DECLARE @project1 INT = (SELECT TOP 1 id FROM dbo.manufacturing_projects WHERE manufacturing_code = 'ND2602001');
DECLARE @project2 INT = (SELECT TOP 1 id FROM dbo.manufacturing_projects WHERE manufacturing_code = 'ND2602002');
DECLARE @project3 INT = (SELECT TOP 1 id FROM dbo.manufacturing_projects WHERE manufacturing_code = 'ND2602003');

DECLARE @inventory1 INT = (
    SELECT TOP 1 id
    FROM dbo.gem_inventory_items
    WHERE COALESCE(balance_ct, parsed_weight_ct, 0) > 0
    ORDER BY COALESCE(parsed_price_per_ct, parsed_price_per_piece, 0) DESC, id
);

DECLARE @inventory2 INT = (
    SELECT TOP 1 id
    FROM dbo.gem_inventory_items
    WHERE id <> ISNULL(@inventory1, -1)
      AND COALESCE(balance_ct, parsed_weight_ct, 0) > 0
    ORDER BY COALESCE(parsed_price_per_ct, parsed_price_per_piece, 0) DESC, id
);

DECLARE @inventory3 INT = (
    SELECT TOP 1 id
    FROM dbo.gem_inventory_items
    WHERE id NOT IN (ISNULL(@inventory1, -1), ISNULL(@inventory2, -1))
      AND COALESCE(balance_ct, parsed_weight_ct, 0) > 0
    ORDER BY COALESCE(parsed_price_per_ct, parsed_price_per_piece, 0) DESC, id
);

IF @project1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.manufacturing_project_gemstones WHERE project_id = @project1)
BEGIN
    INSERT INTO dbo.manufacturing_project_gemstones (project_id, inventory_item_id, gemstone_code, gemstone_type, pieces_used, weight_used_ct, line_cost, notes)
    SELECT @project1, @inventory1, CAST(gemstone_number AS NVARCHAR(64)), gemstone_type, 3, 4.8, 72000, N'Primary center set'
    FROM dbo.gem_inventory_items WHERE id = @inventory1;

    INSERT INTO dbo.manufacturing_project_gemstones (project_id, inventory_item_id, gemstone_code, gemstone_type, pieces_used, weight_used_ct, line_cost, notes)
    SELECT @project1, @inventory2, CAST(gemstone_number AS NVARCHAR(64)), gemstone_type, 6, 2.4, 28000, N'Side accent stones'
    FROM dbo.gem_inventory_items WHERE id = @inventory2;
END

IF @project2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.manufacturing_project_gemstones WHERE project_id = @project2)
BEGIN
    INSERT INTO dbo.manufacturing_project_gemstones (project_id, inventory_item_id, gemstone_code, gemstone_type, pieces_used, weight_used_ct, line_cost, notes)
    SELECT @project2, @inventory2, CAST(gemstone_number AS NVARCHAR(64)), gemstone_type, 2, 1.8, 19000, N'Brooch highlights'
    FROM dbo.gem_inventory_items WHERE id = @inventory2;
END

IF @project3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.manufacturing_project_gemstones WHERE project_id = @project3)
BEGIN
    INSERT INTO dbo.manufacturing_project_gemstones (project_id, inventory_item_id, gemstone_code, gemstone_type, pieces_used, weight_used_ct, line_cost, notes)
    SELECT @project3, @inventory3, CAST(gemstone_number AS NVARCHAR(64)), gemstone_type, 8, 3.1, 26000, N'Matched pair layout'
    FROM dbo.gem_inventory_items WHERE id = @inventory3;
END

IF @project1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.manufacturing_activity_log WHERE project_id = @project1)
BEGIN
    INSERT INTO dbo.manufacturing_activity_log (project_id, status, activity_at_utc, craftsman_name, notes)
    VALUES
        (@project1, N'approved', DATEADD(DAY, -48, SYSUTCDATETIME()), N'Pichai', N'Project approved for production.'),
        (@project1, N'stone_setting', DATEADD(DAY, -28, SYSUTCDATETIME()), N'Pichai', N'Stone setting completed.'),
        (@project1, N'sold', DATEADD(DAY, -10, SYSUTCDATETIME()), N'Pichai', N'Sold to VIP client.');
END

IF @project2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.manufacturing_activity_log WHERE project_id = @project2)
BEGIN
    INSERT INTO dbo.manufacturing_activity_log (project_id, status, activity_at_utc, craftsman_name, notes)
    VALUES
        (@project2, N'approved', DATEADD(DAY, -32, SYSUTCDATETIME()), N'Tui', N'Project kickoff approved.'),
        (@project2, N'ready_for_sale', DATEADD(DAY, -4, SYSUTCDATETIME()), N'Tui', N'Ready for showroom release.');
END

IF @project3 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.manufacturing_activity_log WHERE project_id = @project3)
BEGIN
    INSERT INTO dbo.manufacturing_activity_log (project_id, status, activity_at_utc, craftsman_name, notes)
    VALUES
        (@project3, N'approved', DATEADD(DAY, -12, SYSUTCDATETIME()), N'Ti', N'Blueprint and casting approved.'),
        (@project3, N'stone_setting', DATEADD(DAY, -2, SYSUTCDATETIME()), N'Ti', N'Active stone-setting stage.');
END
GO
