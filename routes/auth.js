const express = require('express');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const router = express.Router();

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

router.get('/auth/discord', passport.authenticate('discord'));
router.get('/auth/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/?login=failed' }),
  (req, res) => res.redirect('/?login=success')
);

router.get('/auth/me', (req, res) => {
  if (req.user) res.json({ loggedIn: true, username: req.user.username });
  else res.json({ loggedIn: false });
});

router.get('/auth/logout', (req, res) => req.logout(() => res.redirect('/')));

module.exports = router;