export const getStudentJobEligibilityReason = (job, student) => {
  const eligibleColleges = job.eligibleColleges || [];
  if (!student.college || !eligibleColleges.some((collegeId) => collegeId.toString() === student.college.toString())) return "This job is not open to your college.";
  if (job.allowedBranches?.length && !job.allowedBranches.includes(student.branch)) return "This job is not open to your branch.";
  if (job.batchEligible?.length && !job.batchEligible.includes(String(student.batch))) return "This job is not open to your graduation batch.";
  if (student.cgpa < (job.cgpaCutoff || 0)) return `Minimum CGPA required: ${job.cgpaCutoff}.`;
  if ((job.tenthCutoff || 0) > 0 && student.tenthPercentage == null) return "Add your 10th percentage to your profile to check eligibility.";
  if ((job.tenthCutoff || 0) > 0 && student.tenthPercentage < job.tenthCutoff) return `Minimum 10th percentage required: ${job.tenthCutoff}%.`;
  if ((job.twelfthCutoff || 0) > 0 && student.twelfthPercentage == null) return "Add your 12th percentage to your profile to check eligibility.";
  if ((job.twelfthCutoff || 0) > 0 && student.twelfthPercentage < job.twelfthCutoff) return `Minimum 12th percentage required: ${job.twelfthCutoff}%.`;
  return null;
};
