const express = require("express");
const Transaction = require("../models/Transaction");

const router = express.Router();

/* ================= ADD TRANSACTION ================= */
router.post("/", async (req, res) => {
  try {
    const transaction = await Transaction.create(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

/* ================= ANALYTICS ================= */
router.get("/analytics", async (req, res) => {
  try {
    const { type } = req.query;
    let startDate = new Date();

    if (type === "weekly") startDate.setDate(startDate.getDate() - 7);
    else if (type === "monthly") startDate.setMonth(startDate.getMonth() - 1);
    else if (type === "yearly") startDate.setFullYear(startDate.getFullYear() - 1);

    const transactions = await Transaction.find({
      createdAt: { $gte: startDate },
    });

    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      if (t.type === "income") income += t.amount;
      if (t.type === "expense") expense += t.amount;
    });

    res.json({
      period: type,
      income,
      expense,
      balance: income - expense,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= SUMMARY ================= */
router.get("/summary", async (req, res) => {
  try {
    const transactions = await Transaction.find();
    let income = 0;
    let expense = 0;

    transactions.forEach((t) => {
      if (t.type === "income") income += t.amount;
      if (t.type === "expense") expense += t.amount;
    });

    res.json({
      income,
      expense,
      balance: income - expense,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= FILTER ================= */  
router.get("/filter", async (req, res) => {
  try {
    const { category, division, startDate, endDate } = req.query;
    let filter = {};

    if (category) filter.category = category;
    if (division) filter.division = division;

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate + "T00:00:00"),
        $lte: new Date(endDate + "T23:59:59"),
      };
    }

    const transactions = await Transaction.find(filter).sort({
      createdAt: -1,
    });

    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= GET ALL ================= */
router.get("/", async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= EDIT (12 HOURS LOCK) ================= */
router.put("/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });

    const diffHours =
      (Date.now() - new Date(transaction.createdAt)) / (1000 * 60 * 60);

    if (diffHours > 12)
      return res.status(403).json({ message: "Edit not allowed after 12 hours" });

    const updated = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

/* ================= DELETE TRANSFER (BOTH SIDES) ================= */
router.delete("/transfer/:transferId", async (req, res) => {
  try {
    await Transaction.deleteMany({
      transferId: req.params.transferId,
    });
    res.json({ message: "Transfer deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ================= DELETE NORMAL TRANSACTION ================= */
router.delete("/:id", async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction)
      return res.status(404).json({ message: "Transaction not found" });

    await transaction.deleteOne();
    res.json({ message: "Transaction deleted" });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


/* ================= ACCOUNT TRANSFER ================= */
router.post("/transfer", async (req, res) => {
  try {
    const { fromAccount, toAccount, amount, division = "personal" } = req.body;

    if (!fromAccount || !toAccount || !amount) {
      return res.status(400).json({ message: "All fields required" });
    }

    if (fromAccount === toAccount) {
      return res.status(400).json({ message: "Same account not allowed" });
    }

    const transferId = Date.now().toString();

    await Transaction.create({
      type: "expense",
      amount,
      category: "transfer",
      division,
      account: fromAccount,
      transferId,
    });

    await Transaction.create({
      type: "income",
      amount,
      category: "transfer",
      division,
      account: toAccount,
      transferId,
    });

    res.json({ message: "Transfer successful", transferId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
