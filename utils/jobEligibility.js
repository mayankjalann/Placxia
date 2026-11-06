export const getStudentJobEligibilityReason = (job, student) => {
  if (job.allowedBranches?.length && !job.allowedBranches.includes(student.branch)) return `This role is open to ${job.allowedBranches.join(", ")} students.`;
  if (Number(student.cgpa || 0) < Number(job.cgpaCutoff || 0)) return `Minimum CGPA required: ${job.cgpaCutoff}.`;
  return null;
};
