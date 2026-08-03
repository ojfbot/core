Reference for `/triage` Step 3: the scoring weights and tie-break order.

```
severity_weight: p0=8, p1=4, p2=2, p3=1
effort_weight:   xs=1, s=2, m=4, l=8, xl=16
```

Sort descending. Ties broken by: (a) older first (FIFO for same priority), (b) bug type before feature type.
