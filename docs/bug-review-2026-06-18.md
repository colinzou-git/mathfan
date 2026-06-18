# Main Branch Bug Review — 2026-06-18

This review found and fixed three reproducible defects:

1. Repeated **Learn Extra** sessions skipped an untouched batch of unseen questions because the candidate pool was already filtered and then offset a second time.
2. Goal `daysRemaining` could be one day too high across the fall daylight-saving transition because local midnights were divided by a fixed 24-hour duration.
3. Google Drive sync treated failed file-list and snapshot-download requests as though no remote snapshot existed, which could report false success, create duplicate sync files, or allow a later push to overwrite cloud-only progress.

Regression tests cover sequential Learn Extra selection, daylight-saving-safe calendar-day counts, Drive failure propagation, and newest-file selection when duplicate sync files already exist.
