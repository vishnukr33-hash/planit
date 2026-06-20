const router = require('express').Router();
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Role hierarchy: who can create whom
const canCreate = {
  admin: ['head', 'teamlead', 'user'],
  head: ['teamlead'],
  teamlead: ['user'],
  user: [],
};

// Get users visible to current user based on hierarchy
router.get('/', protect, async (req, res) => {
  try {
    const { search, status, role, page = 1, limit = 50 } = req.query;
    const query = {};

    if (req.user.role === 'admin') {
      // Admin sees everyone except other admins
      query.role = { $ne: 'admin' };
    } else if (req.user.role === 'head') {
      // Head sees only their direct children (teamleads)
      query.parentId = req.user._id;
    } else if (req.user.role === 'teamlead') {
      // Team Lead sees only their direct children (users)
      query.parentId = req.user._id;
    } else {
      // Regular users can't see other users
      return res.json({ users: [], total: 0 });
    }

    if (status) query.status = status;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { username: new RegExp(search, 'i') },
        { employeeCode: new RegExp(search, 'i') },
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .populate('parentId', 'name role')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });
    res.json({ users, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all subordinates recursively (for task assignment dropdown)
router.get('/subordinates', protect, async (req, res) => {
  try {
    if (req.user.role === 'user') return res.json({ users: [] });

    let users = [];
    if (req.user.role === 'admin') {
      // Admin can assign to heads
      users = await User.find({ role: 'head', status: 'active' }).select('name employeeCode role');
    } else if (req.user.role === 'head') {
      // Head can assign to their teamleads
      users = await User.find({ parentId: req.user._id, status: 'active' }).select('name employeeCode role');
    } else if (req.user.role === 'teamlead') {
      // Team Lead can assign to their users
      users = await User.find({ parentId: req.user._id, status: 'active' }).select('name employeeCode role');
    }
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single user
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate('parentId', 'name role');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create user — role-based
router.post('/', protect, async (req, res) => {
  try {
    const allowedRoles = canCreate[req.user.role] || [];
    const newRole = req.body.role || 'user';

    if (!allowedRoles.includes(newRole)) {
      return res.status(403).json({ message: `Your role (${req.user.role}) cannot create ${newRole} users` });
    }

    const userData = { ...req.body, parentId: req.user._id, role: newRole };
    const user = await User.create(userData);
    res.status(201).json(user);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ message: 'Employee code, email or username already exists' });
    res.status(500).json({ message: err.message });
  }
});

// Update user
router.put('/:id', protect, async (req, res) => {
  try {
    const { password, role, ...rest } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, rest, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle status
router.patch('/:id/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.status = user.status === 'active' ? 'inactive' : 'active';
    await user.save({ validateBeforeSave: false });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Reset password
router.patch('/:id/reset-password', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.password = req.body.password;
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete user
router.delete('/:id', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
