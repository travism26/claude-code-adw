# Setting up the factory's GitHub App

The factory's workflows act on GitHub as a GitHub App, not as you and not as the built-in
`GITHUB_TOKEN`. There are two reasons:

- **Chains.** GitHub does not start a workflow for an event caused by `GITHUB_TOKEN`. If Review
  added the `rework` label with that token, the label would appear, the run would go green, and
  the next workflow would never start. Events caused by an App token do start workflows.
- **Identity.** The App's comments and labels show up as `<app-name>[bot]`, so you can tell the
  factory's actions from yours. It also gets its own rate limit.

This guide takes about fifteen minutes. You need admin access to the repository and an Anthropic
account. Do the steps in order. Do them after the PR that adds `.github/workflows/review.yml` has
been merged into `main`.

## What you will end up with

Three values stored on the repository, under exactly these names. The workflows read these names.

| Name | Kind | What it holds |
|---|---|---|
| `FACTORY_APP_CLIENT_ID` | Variable | The App's Client ID (it starts with `Iv`) |
| `FACTORY_APP_KEY` | Secret | The App's private key: the whole `.pem` file |
| `ANTHROPIC_API_KEY` | Secret | An Anthropic API key that the review agent bills to |

## Step 1. Create the App

1. Open <https://github.com/settings/apps/new>. (Or go to your profile picture, then **Settings**,
   then **Developer settings** at the bottom of the left sidebar, then **GitHub Apps**, then
   **New GitHub App**.)
2. **GitHub App name**: pick a name, for example `claude-code-adw-factory`. Names are unique across
   all of GitHub, so add something of your own if it is taken. This name is what appears on the
   factory's comments.
3. **Homepage URL**: the repository's URL, `https://github.com/travism26/claude-code-adw`.
4. **Identifying and authorizing users**: leave everything empty and unticked. The App never acts
   for a user.
5. **Post installation**: leave empty.
6. **Webhook**: untick **Active**. The workflows get their events from GitHub Actions itself. The
   App is only an identity, so it needs no webhook, no URL and no secret.
7. **Permissions**: open **Repository permissions** and set exactly these. Leave everything else at
   **No access**.

   | Permission | Access | Why |
   |---|---|---|
   | Contents | Read-only | Read the repository |
   | Issues | Read and write | Read the Ticket a PR closes. Add and remove labels (GitHub stores PR labels as issue labels). |
   | Pull requests | Read and write | Read the PR, post the review comment, change its labels |
   | Metadata | Read-only | Required by GitHub; it is set for you |

   Leave **Organization permissions** and **Account permissions** at **No access**.

8. **Subscribe to events**: tick nothing. With the webhook off, this section may be greyed out.
9. **Where can this GitHub App be installed?**: choose **Only on this account**.
10. Click **Create GitHub App**.

Later phases need more. Implement (phase 4) pushes branches and opens PRs, so it needs
**Contents: Read and write**. It also needs **Workflows: Read and write** if an agent may ever edit
files under `.github/workflows/`. Do not grant these now. When you add a permission later, GitHub
asks you to approve the change on the installation before it applies.

## Step 2. Copy the Client ID and make a private key

You are now on the App's settings page (**General**).

1. Near the top, under **About**, find **Client ID**. Copy it; you need it in Step 4.
   Use the Client ID, not the App ID number: `actions/create-github-app-token@v3` takes the Client
   ID.
2. Scroll down to **Private keys** and click **Generate a private key**. Your browser downloads a
   file named like `claude-code-adw-factory.2026-11-03.private-key.pem`. Anyone holding this file
   can act as the App, so treat it like a password.

## Step 3. Install the App on this repository

1. In the left sidebar of the App's settings, click **Install App**.
2. Click **Install** next to your account.
3. Choose **Only select repositories**, and select `claude-code-adw`.
4. Click **Install**.

The App can now act on this one repository and no other.

## Step 4. Store the three values on the repository

Open the repository on GitHub, then **Settings**, then **Secrets and variables** in the left
sidebar, then **Actions**.

1. **The Client ID, as a variable.** Open the **Variables** tab and click
   **New repository variable**. Name: `FACTORY_APP_CLIENT_ID`. Value: the Client ID from Step 2.
   Click **Add variable**. (A variable rather than a secret, because a Client ID is not secret and
   it is useful to see it in logs.)
2. **The private key, as a secret.** Open the **Secrets** tab and click
   **New repository secret**. Name: `FACTORY_APP_KEY`. Value: open the `.pem` file in a text editor
   and paste all of it, including the `-----BEGIN RSA PRIVATE KEY-----` and
   `-----END RSA PRIVATE KEY-----` lines. Click **Add secret**.
3. **The Anthropic API key, as a secret.** Make a key at <https://console.anthropic.com/> under
   **API keys**. It is best to make it in a workspace of its own with a monthly spend limit (set the
   limit under the workspace's **Limits**), so the factory can never spend more than you chose. Then
   add a repository secret named `ANTHROPIC_API_KEY` with the key as its value.

If you prefer the terminal, these three commands do the same, run from a clone of the repository:

```bash
gh variable set FACTORY_APP_CLIENT_ID --body "Iv23li..."          # your Client ID
gh secret set FACTORY_APP_KEY < ~/Downloads/claude-code-adw-factory.*.private-key.pem
gh secret set ANTHROPIC_API_KEY                                     # prompts; paste the key
```

Then delete the downloaded `.pem` file, or move it into your password manager. GitHub keeps the
secret, and you can always generate a new key from the App's settings.

## Step 5. Create the labels

Review adds `rework`, `rework:1` to `rework:3` and `ready-for-human`. If a label does not exist,
the step that adds it fails. From a clone of the repository:

```bash
uv run adws/actions/sync_labels.py            # dry run: lists what it would create or fix
uv run adws/actions/sync_labels.py --apply    # creates and fixes them
```

It never deletes a label. Running it again is safe: the second time it finds nothing to change.

## Step 6. Optional: set the limits

These are repository variables too (the **Variables** tab from Step 4). Leave them unset to get the
defaults.

| Variable | Default | Meaning |
|---|---|---|
| `FACTORY_DAILY_RUN_CAP` | `20` | Review runs per UTC day. Set it to `0` to stop the factory without deleting anything. |
| `FACTORY_REVIEW_BUDGET_USD` | `2` | The most one review may spend. The check happens between the agent's turns, so the last turn can go a few cents over. A test review of a 500-line diff with Sonnet cost about $0.16. |
| `FACTORY_REVIEW_MODEL` | `sonnet` | `sonnet`, `opus` or `haiku` |

## Step 7. Confirm the chain fires

This test opens a throwaway PR whose description asks for something the change does not do. Review
should block it, label it with the App's identity, and that label should start the Rework workflow.

1. Make a branch whose name starts with `adw/`, from an up-to-date `main`, and add a small change:

   ```bash
   git switch main && git pull
   git switch -c adw/factory-smoke-test
   echo "factory smoke test" > factory-smoke.txt
   git add factory-smoke.txt && git commit -m "factory smoke test"
   git push -u origin adw/factory-smoke-test
   ```

2. Open it as a draft PR, with a requirement the change does not meet:

   ```bash
   gh pr create --draft --title "Factory smoke test" --body "$(printf '%s\n' \
     'Smoke test for the factory review. Close without merging.' '' \
     '## Acceptance criteria' \
     '- Adds a file `docs/factory/smoke.md` containing a table of the three factory variables.')"
   ```

3. Open the repository's **Actions** tab. No **Review** run has started, because Review ignores
   draft PRs. That is correct.
4. Mark the PR ready: `gh pr ready`. A new **Review** run starts. When it finishes (a minute or two):
   - The run is green.
   - The PR has a comment from `<your-app-name>[bot]` that starts with **Factory review: BLOCKED**,
     with a **Spec** section naming the missing `docs/factory/smoke.md`.
   - The PR has the labels `rework` and `rework:1`, added by `<your-app-name>[bot]`.
5. Back in **Actions**, a **Rework** run has started. Open it. Its summary says the PR was labelled
   `rework` by `<your-app-name>[bot]`. **This run is the proof the chain works.** A label added
   with `GITHUB_TOKEN` would not have started it.
6. Clean up: `gh pr close --delete-branch`.

## If something goes wrong

| What you see | What it means | What to do |
|---|---|---|
| Review fails with **Factory not configured: Missing ...** | One of the three values is missing or misnamed | Check the names in Step 4 exactly, including the Variables and Secrets tabs |
| The **Mint the factory App token** step fails with `Not Found` or an installation error | The App is not installed on this repository, or the Client ID belongs to another App | Redo Step 3, and check the Client ID |
| The token step fails with a key error | The secret is not the full `.pem` file | Paste the whole file, both `-----` lines included, into `FACTORY_APP_KEY` |
| **Daily run cap reached** | Review has started `FACTORY_DAILY_RUN_CAP` runs today (UTC) | Wait for tomorrow or raise the variable, then click **Re-run jobs** |
| The **Review** step fails with `the review agent failed` | The API key is wrong, out of credit, or the run hit its budget | Check the key and the workspace limit in the Anthropic console; raise `FACTORY_REVIEW_BUDGET_USD` if the diff is large |
| The **Post the reports** step fails with `are the labels synced?` | A label Review adds does not exist | Run Step 5 |
| No **Review** run at all | It only reviews PRs from `adw/*` branches of this repository, opened by a collaborator. Draft PRs and PRs labelled `ready-for-human` are skipped | Check the branch name and that the PR is marked ready |
| Review blocks, but no **Rework** run starts | The label was not added with the App token | Check the label's author in the PR timeline: it must be `<your-app-name>[bot]` |

To turn the factory off for a while, set `FACTORY_DAILY_RUN_CAP` to `0`. To revoke it completely,
uninstall the App (your profile, **Settings**, **Applications**, **Installed GitHub Apps**) or
delete its private key from the App's settings.
