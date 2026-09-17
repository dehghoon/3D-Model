export const metadata = {
  title: "Privacy Policy | Linkoteq",
  description: "Privacy policy for Linkoteq services and GPT integrations.",
};

export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 72px", lineHeight: 1.65 }}>
      <h1>Linkoteq Privacy Policy</h1>
      <p><strong>Effective date:</strong> September 17, 2026</p>

      <p>
        This Privacy Policy describes how Linkoteq handles information when users interact with
        Linkoteq web services and Linkoteq GPT integrations, including GitHub-connected engineering
        workflows.
      </p>

      <h2>Information processed</h2>
      <p>
        Linkoteq workflows may process information that a user intentionally provides, including
        structural drawings, project files, engineering metadata, prompts, and repository content
        required to perform an authorized task. GitHub-connected GPT actions may send repository
        identifiers, file paths, file content, commit metadata, and workflow status requests to the
        GitHub API.
      </p>

      <h2>GitHub authentication</h2>
      <p>
        GitHub credentials are used only to authenticate authorized GitHub API requests. Access
        tokens should be supplied through the platform's authentication mechanism and must not be
        embedded in prompts, source files, schemas, logs, or public repository content. Linkoteq
        engineering agents are instructed to use only the repository permissions required for their
        assigned work.
      </p>

      <h2>How information is used</h2>
      <p>
        Information is processed to perform requested engineering operations, inspect and update
        authorized repositories, validate contracts and tests, produce detection or reconstruction
        artifacts, and report verification results. Detector evidence is kept separate from
        canonical engineering geometry according to Linkoteq's repository contracts.
      </p>

      <h2>Third-party services</h2>
      <p>
        Authorized workflows may interact with third-party services such as GitHub and OpenAI.
        Information transmitted to those services is also subject to their applicable terms and
        privacy practices.
      </p>

      <h2>Data minimization and security</h2>
      <p>
        Linkoteq workflows are designed to request only information needed for the task. Users
        should not place passwords, personal access tokens, API secrets, or other credentials in
        prompts or repository files. Security-specific engineering decisions are handled through
        Linkoteq's designated security workflow.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Repository changes and engineering artifacts may remain in the repositories and systems in
        which they are intentionally stored. Retention by third-party platforms is governed by
        those platforms and the applicable account configuration. Requests concerning Linkoteq-
        controlled data should be directed to the contact channel published by Linkoteq.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        This policy may be updated as Linkoteq services and integrations evolve. Material changes
        should be reflected by updating this page and its effective date.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy or data-handling questions, use the official contact channel published on the
        Linkoteq website.
      </p>
    </main>
  );
}
