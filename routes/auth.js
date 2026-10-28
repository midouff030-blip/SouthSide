const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const router = express.Router();
const User = require('../models/User');

// ===== CONFIG DISCORD =====
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (e) { done(e, null); }
});

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ discordId: profile.id });
    if (!user) {
      user = await User.create({
        discordId: profile.id,
        username: profile.username,
        discriminator: profile.discriminator,
        avatar: profile.avatar
      });
    }
    return done(null, user);
  } catch (e) { return done(e, null); }
}));

// ===== ROUTES =====
router.get('/auth/discord', passport.authenticate('discord'));

router.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/?login=failed' }),
  (req, res) => res.redirect('/?login=success')
);

router.get('/auth/me', (req, res) => {
  if (req.user) {
    res.json({
      loggedIn: true,
      username: req.user.username,
      avatar: req.user.avatar,
      isAdmin: req.user.isAdmin
    });
  } else {
    res.json({ loggedIn: false });
  }
});

router.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

// Alias pour compatibilité avec ton HTML
router.get('/auth/login', (req, res) => {
  res.redirect('/api/auth/discord');
});

module.exports = router;