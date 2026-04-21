# Troubleshooting

This section covers common issues and their solutions when using Nginx Warden.

## Installation Issues

### Database Connection Failed

**Problem:** Nginx Warden cannot connect to the database.

**Solution:**
1. Check that your database server is running
2. Verify the database connection settings in your `.env` file
3. Ensure the database user has the necessary permissions
4. Check if the database exists


## Domain Issues

### Domain Not Working

**Problem:** A newly created domain is not accessible.

**Solution:**
1. Check that the DNS record for the domain is pointing to your server
2. Verify that Nginx configuration was generated correctly
3. Reload Nginx configuration

```bash
# Check Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### SSL Certificate Not Issued

**Problem:** Let's Encrypt certificate cannot be issued.

**Solution:**
1. Ensure the domain is pointing to your server
2. Check that port 80 is accessible from the internet
3. Verify that Let's Encrypt can reach the validation file



## ModSecurity Issues

### ModSecurity Not Working

**Problem:** ModSecurity rules are not being applied.

**Solution:**
1. Verify that ModSecurity is installed and enabled
2. Check that the ModSecurity configuration is correct
3. Ensure the rule set is properly configured



### False Positives

**Problem:** Legitimate requests are being blocked by ModSecurity.

**Solution:**
1. Review the ModSecurity logs to identify the rule causing the issue
2. Create exclusions for specific rules or endpoints
3. Consider lowering the paranoia level

