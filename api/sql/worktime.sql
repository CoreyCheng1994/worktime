-- 工作记录相关表结构
CREATE TABLE work_daily_record (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  work_date    DATE NOT NULL,
  created_time DATETIME NOT NULL,
  updated_time DATETIME NOT NULL,
  UNIQUE KEY uk_work_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE work_record_item (
  id             BIGINT PRIMARY KEY AUTO_INCREMENT,
  record_id      BIGINT NOT NULL,

  item_type      TINYINT NOT NULL,  -- 0 TEXT, 1 REF
  status         TINYINT NOT NULL,  -- 0 未完成, 1 部分完成, 2 完成

  text_value     MEDIUMTEXT NULL,   -- TEXT 专用

  ref_uid        BIGINT NULL,       -- REF 专用
  progress_start TINYINT NULL,      -- REF 专用: 0-99
  progress_end   TINYINT NULL,      -- REF 专用: 1-100

  sort           INT NOT NULL DEFAULT 0,
  created_time   DATETIME NOT NULL,
  updated_time   DATETIME NOT NULL,

  KEY idx_record_id (record_id),
  CONSTRAINT fk_item_record
    FOREIGN KEY (record_id) REFERENCES work_daily_record(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE work_time_slot (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  work_date    DATE NOT NULL,
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  sort         INT NOT NULL DEFAULT 0,
  created_time DATETIME NOT NULL,
  updated_time DATETIME NOT NULL,

  KEY idx_work_date (work_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE work_holiday_calendar (
  id           BIGINT PRIMARY KEY AUTO_INCREMENT,
  holiday_date DATE NOT NULL,
  day_type     TINYINT NOT NULL,      -- 1 法定节假日, 2 调休补班
  day_label    VARCHAR(16) NOT NULL,  -- 日历标签，如“休”“班”“春节”
  day_name     VARCHAR(64) NOT NULL,  -- 完整名称
  source_year  SMALLINT NOT NULL,     -- 规则所属年份
  created_time DATETIME NOT NULL,
  updated_time DATETIME NOT NULL,

  UNIQUE KEY uk_holiday_date (holiday_date),
  KEY idx_source_year (source_year),
  KEY idx_holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
